import { createServiceClient } from "./supabase"
import { decrypt } from "./crypto"

const GRAPH = "https://graph.facebook.com/v25.0"

async function igGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  const data = await res.json()
  if (data.error) throw new Error(data.error?.message ?? JSON.stringify(data.error))
  return data
}

async function igPost(path: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error?.message ?? JSON.stringify(data.error))
  return data
}

// User access token (descriptografado) de meta_connections
async function getUserToken(tenantId: string): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("meta_connections")
    .select("access_token_encrypted")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .eq("is_active", true)
    .single()
  if (!data?.access_token_encrypted)
    throw new Error("Conta Meta não conectada. Conecte em Configurações → Meta Ads.")
  return decrypt(data.access_token_encrypted)
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export async function syncIgAccounts(tenantId: string) {
  const userToken = await getUserToken(tenantId)

  const pages = await igGet("/me/accounts", {
    access_token: userToken,
    fields: "id,name,instagram_business_account{id,name,username,profile_picture_url}",
    limit: "100",
  })

  const accounts: any[] = []
  for (const page of pages.data ?? []) {
    const ig = page.instagram_business_account
    if (!ig) continue

    // Busca o page access token corretamente via GET /{page-id}?fields=access_token
    let pageToken: string | null = null
    try {
      const pageData = await igGet(`/${page.id}`, {
        fields: "access_token",
        access_token: userToken,
      })
      pageToken = pageData.access_token ?? null
    } catch {}

    accounts.push({
      tenant_id:           tenantId,
      ig_user_id:          ig.id,
      ig_username:         ig.username ?? null,
      ig_name:             ig.name ?? null,
      profile_picture_url: ig.profile_picture_url ?? null,
      page_id:             page.id,
      page_access_token:   pageToken,
    })
  }

  if (accounts.length) {
    const supabase = createServiceClient()
    await supabase.from("ig_accounts").upsert(accounts, { onConflict: "tenant_id,ig_user_id" })
  }

  return accounts
}

export async function getIgAccounts(tenantId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("ig_accounts")
    .select("id,ig_user_id,ig_username,ig_name,profile_picture_url,page_id")
    .eq("tenant_id", tenantId)
    .order("ig_name")
  return data ?? []
}

export async function getPageToken(tenantId: string, igUserId: string): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("ig_accounts")
    .select("page_access_token")
    .eq("tenant_id", tenantId)
    .eq("ig_user_id", igUserId)
    .single()
  if (!data?.page_access_token)
    throw new Error("Page token não encontrado. Sincronize as contas novamente.")
  return data.page_access_token
}

// ─── Media — usa user token, não page token ───────────────────────────────────

export async function getIgMedia(tenantId: string, igUserId: string) {
  const userToken = await getUserToken(tenantId)
  const res = await igGet(`/${igUserId}/media`, {
    access_token: userToken,
    fields: "id,caption,media_type,media_url,thumbnail_url,timestamp,permalink",
    limit: "24",
  })
  return res.data ?? []
}

// ─── Media insights (Reels/Feed/Story) ────────────────────────────────────────

function toMetricMap(res: any): Record<string, number> {
  const out: Record<string, number> = {}
  for (const m of res.data ?? []) out[m.name] = m.values?.[0]?.value ?? m.total_value?.value ?? 0
  return out
}

// "views" e "total_interactions" estão em desenvolvimento na API da Meta — se a conta
// não tiver acesso, o pedido inteiro falha mesmo as outras métricas sendo válidas.
// Por isso tenta o conjunto completo primeiro e cai pro conjunto estável se falhar.
async function getMediaInsights(mediaId: string, token: string, mediaProductType: string | null) {
  const metricSets: Record<string, string[]> = {
    REELS: ["reach,likes,comments,shares,saved,total_interactions,views", "reach,likes,comments,shares,saved"],
    FEED:  ["reach,likes,comments,shares,saved,total_interactions,follows,profile_visits", "reach,likes,comments,shares,saved"],
    STORY: ["reach,likes,comments,shares,total_interactions,follows,profile_visits", "reach,likes,comments,shares"],
  }
  const attempts = metricSets[mediaProductType ?? ""] ?? ["reach,likes,comments,shares,saved", "reach,likes,comments"]

  for (const metric of attempts) {
    try {
      const res = await igGet(`/${mediaId}/insights`, { access_token: token, metric })
      return toMetricMap(res)
    } catch { /* tenta o próximo conjunto, mais restrito */ }
  }
  return { _error: "Não foi possível obter insights para esta mídia." }
}

// Lista mídia de um perfil num período, opcionalmente filtrando por tipo (ex: "REELS"),
// com as métricas de cada item já anexadas. media_product_type e insights por mídia só
// existem na API com Login do Facebook — contas conectadas via esse fluxo, que é o único
// suportado pelo GTPRO hoje.
export async function getIgMediaWithInsights(
  tenantId: string,
  igUserId: string,
  opts: { since?: string; until?: string; mediaType?: "REELS" | "FEED" | "STORY" | "AD" } = {}
) {
  const userToken = await getUserToken(tenantId)
  const baseParams: Record<string, string> = {
    access_token: userToken,
    fields: "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count",
    limit: "50",
  }
  if (opts.since) baseParams.since = opts.since
  if (opts.until) baseParams.until = opts.until

  let all: any[] = []
  let after: string | undefined
  do {
    const params = after ? { ...baseParams, after } : baseParams
    const page = await igGet(`/${igUserId}/media`, params)
    all = [...all, ...(page.data ?? [])]
    after = page.paging?.cursors?.after
    if (!page.paging?.next) break
  } while (after)

  const filtered = opts.mediaType ? all.filter(m => m.media_product_type === opts.mediaType) : all

  return Promise.all(filtered.map(async (m) => ({
    id: m.id,
    caption: m.caption ?? null,
    media_type: m.media_type,
    media_product_type: m.media_product_type ?? null,
    timestamp: m.timestamp,
    permalink: m.permalink,
    like_count: m.like_count ?? null,
    comments_count: m.comments_count ?? null,
    insights: await getMediaInsights(m.id, userToken, m.media_product_type ?? null),
  })))
}

// ─── Seguidores (snapshot diário) ──────────────────────────────────────────────
// A Meta não documenta histórico de follower_count além de uma janela recente — não dá
// pra reconstruir o passado. A única forma confiável de medir crescimento ao longo de uma
// iniciativa é capturar o total todo dia e guardar aqui, a partir de agora.

export async function snapshotFollowerCounts(tenantId: string) {
  const userToken = await getUserToken(tenantId)
  const accounts = await getIgAccounts(tenantId)
  const supabase = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)

  const rows: any[] = []
  for (const acc of accounts) {
    try {
      const data = await igGet(`/${acc.ig_user_id}`, { access_token: userToken, fields: "followers_count" })
      if (typeof data.followers_count === "number") {
        rows.push({ tenant_id: tenantId, ig_user_id: acc.ig_user_id, date: today, followers_count: data.followers_count })
      }
    } catch (e: any) {
      console.error(`[instagram] snapshotFollowerCounts ${acc.ig_user_id}:`, e.message)
    }
  }

  if (rows.length) {
    await supabase.from("ig_follower_history").upsert(rows, { onConflict: "tenant_id,ig_user_id,date" })
  }
  return rows
}

export async function getFollowerHistory(tenantId: string, igUserId: string, since?: string, until?: string) {
  const supabase = createServiceClient()
  let q = supabase
    .from("ig_follower_history")
    .select("date,followers_count")
    .eq("tenant_id", tenantId)
    .eq("ig_user_id", igUserId)
    .order("date")
  if (since) q = q.gte("date", since)
  if (until) q = q.lte("date", until)
  const { data } = await q
  return data ?? []
}

// ─── Actions — usa page token ─────────────────────────────────────────────────

export async function sendIgDM(igUserId: string, commentId: string, message: string, pageToken: string) {
  return igPost(`/${igUserId}/messages`, pageToken, {
    recipient: { comment_id: commentId },
    message: { text: message },
    messaging_type: "RESPONSE",
  })
}

export async function replyToComment(commentId: string, message: string, pageToken: string) {
  return igPost(`/${commentId}/replies`, pageToken, { message })
}

export async function subscribePageToComments(pageId: string, pageToken: string) {
  return igPost(`/${pageId}/subscribed_apps`, pageToken, {
    subscribed_fields: "comments,mentions",
  })
}

// ─── Flows ────────────────────────────────────────────────────────────────────

export async function getFlows(tenantId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("ig_flows")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
  return data ?? []
}

export async function createFlow(tenantId: string, body: Record<string, any>) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("ig_flows")
    .insert({ ...body, tenant_id: tenantId })
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function updateFlow(tenantId: string, id: string, body: Record<string, any>) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("ig_flows")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("tenant_id", tenantId)
    .select()
    .single()
  if (error) throw new Error(error.message)
  return data
}

export async function deleteFlow(tenantId: string, id: string) {
  const supabase = createServiceClient()
  await supabase.from("ig_flows").delete().eq("id", id).eq("tenant_id", tenantId)
}

export async function findFlowsForComment(igUserId: string, mediaId: string): Promise<any[]> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("ig_flows")
    .select("*")
    .eq("ig_user_id", igUserId)
    .eq("is_active", true)
    .or(`media_id.is.null,media_id.eq.${mediaId}`)
  return data ?? []
}

export async function incrementExecutions(id: string) {
  try {
    const supabase = createServiceClient()
    await supabase.rpc("increment_ig_flow_executions", { flow_id: id })
  } catch {}
}
