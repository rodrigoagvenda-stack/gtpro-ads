import { createServiceClient } from "./supabase"
import { MetaError } from "./meta-ads"

const GRAPH = "https://graph.facebook.com/v25.0"

async function igGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}${path}`)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { next: { revalidate: 0 } })
  const data = await res.json()
  if (data.error) throw new MetaError(data.error)
  return data
}

async function igPost(path: string, token: string, body: Record<string, unknown>) {
  const res = await fetch(`${GRAPH}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, access_token: token }),
  })
  const data = await res.json()
  if (data.error) throw new MetaError(data.error)
  return data
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

export async function syncIgAccounts(tenantId: string) {
  const supabase = createServiceClient()
  const { data: conn } = await supabase
    .from("meta_connections")
    .select("access_token")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single()
  if (!conn?.access_token) throw new Error("Conta Meta não conectada. Conecte em Configurações → Meta Ads.")

  const pages = await igGet("/me/accounts", {
    access_token: conn.access_token,
    fields: "id,name,access_token,instagram_business_account{id,name,username,profile_picture_url}",
    limit: "100",
  })

  const accounts: any[] = []
  for (const page of pages.data ?? []) {
    const ig = page.instagram_business_account
    if (!ig) continue
    accounts.push({
      tenant_id:           tenantId,
      ig_user_id:          ig.id,
      ig_username:         ig.username ?? null,
      ig_name:             ig.name ?? null,
      profile_picture_url: ig.profile_picture_url ?? null,
      page_id:             page.id,
      page_access_token:   page.access_token,
    })
  }

  if (accounts.length) {
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
  if (!data?.page_access_token) throw new Error("Conta Instagram não encontrada. Sincronize as contas primeiro.")
  return data.page_access_token
}

// ─── Media ────────────────────────────────────────────────────────────────────

export async function getIgMedia(igUserId: string, pageToken: string) {
  const res = await igGet(`/${igUserId}/media`, {
    access_token: pageToken,
    fields: "id,caption,media_type,media_url,thumbnail_url,timestamp,permalink",
    limit: "24",
  })
  return res.data ?? []
}

// ─── Actions ──────────────────────────────────────────────────────────────────

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
  const supabase = createServiceClient()
  await supabase.rpc("increment_ig_flow_executions", { flow_id: id }).catch(() => {})
}
