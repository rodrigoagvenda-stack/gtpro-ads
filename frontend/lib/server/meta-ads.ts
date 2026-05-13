import { createServiceClient } from "./supabase"
import { decrypt, encrypt } from "./crypto"
import { getMetaAppId, getMetaAppSecret } from "./platform"

const GRAPH = "https://graph.facebook.com/v22.0"

async function getToken(tenantId: string) {
  const { token } = await getTokenAndAccount(tenantId)
  return token
}

async function getTokenAndAccount(tenantId: string, connectionId?: string) {
  const supabase = createServiceClient()

  // Diagnóstico: quais rows existem para esse tenant_id?
  const { data: allRows, error: diagError } = await supabase
    .from("meta_connections")
    .select("id, tenant_id, ad_account_id, active, is_active")
    .eq("tenant_id", tenantId)
  console.log(`[meta-ads] getTokenAndAccount tenant_id=${tenantId} connectionId=${connectionId ?? "none"}`)
  console.log(`[meta-ads] rows found for tenant: ${JSON.stringify(allRows)} error=${diagError?.message ?? "none"}`)

  let q = supabase
    .from("meta_connections")
    .select("access_token_encrypted, ad_account_id")
    .eq("tenant_id", tenantId)
    .eq("active", true)
  if (connectionId) {
    q = (q as any).eq("id", connectionId)
  } else {
    q = (q as any).eq("is_active", true)
  }
  const { data } = await (q as any).single()
  console.log(`[meta-ads] active+is_active query result: ${data ? `found ad_account=${data.ad_account_id}` : "NOT FOUND"}`)
  if (!data) throw new Error(`Conta Meta não conectada (tenant_id=${tenantId}, rows_total=${allRows?.length ?? 0})`)
  return { token: decrypt(data.access_token_encrypted), adAccountId: data.ad_account_id }
}

function parseMetaError(raw: string): string {
  try {
    const json = JSON.parse(raw)
    const err = json?.error
    if (!err) return raw
    const code = err.code
    const sub  = err.error_subcode
    if (code === 190 || err.type === "OAuthException") {
      if (sub === 463 || sub === 467) return "Token Meta expirado. Reconecte sua conta em Configurações → Meta Ads."
      return "Token Meta inválido. Reconecte sua conta em Configurações → Meta Ads."
    }
    if (code === 200 || code === 273) return `Permissão negada pela Meta: ${err.message}`
    if (code === 100)                 return `Parâmetro inválido: ${err.message}`
    if (code === 4 || code === 17 || code === 32 || code === 613) return "Limite de requisições da Meta atingido. Aguarde alguns minutos."
    return err.message ?? raw
  } catch {
    return raw
  }
}

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(parseMetaError(await res.text()))
  return res.json()
}

async function graphPost(path: string, token: string, body: Record<string, unknown>) {
  const url = new URL(`${GRAPH}${path}`)
  url.searchParams.set("access_token", token)
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(parseMetaError(await res.text()))
  return res.json()
}

async function graphDelete(path: string, token: string) {
  const url = new URL(`${GRAPH}${path}`)
  url.searchParams.set("access_token", token)
  const res = await fetch(url.toString(), { method: "DELETE" })
  if (!res.ok) throw new Error(parseMetaError(await res.text()))
  return res.json()
}

// ─── Account ────────────────────────────────────────────────────────────────

export async function getAccountInfo(tenantId: string) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  // funding_source_details removido — requer permissão extra e pode quebrar a resposta
  const fields = "id,name,account_status,currency,timezone_name,timezone_offset_hours_utc,spend_cap,amount_spent,balance,business_name"
  return graphGet(`/act_${adAccountId}`, { access_token: token, fields })
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export async function getCampaigns(tenantId: string, datePreset = "last_7d", connectionId?: string) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId, connectionId)
  const insightFields = "spend,impressions,clicks,reach,ctr,cpc,cpm,actions,action_values,purchase_roas"
  const fields = `id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,budget_remaining,buying_type,insights.date_preset(${datePreset}){${insightFields}}`

  // Paginação completa — contas com mais de 100 campanhas
  let all: any[] = []
  let after: string | undefined
  do {
    const params: Record<string, string> = { access_token: token, fields, limit: "100" }
    if (after) params.after = after
    const page = await graphGet(`/act_${adAccountId}/campaigns`, params)
    all = [...all, ...(page.data ?? [])]
    after = page.paging?.cursors?.after
    if (!page.paging?.next) break
  } while (after)

  return all.map((c: any) => {
    const ins     = c.insights?.data?.[0] ?? {}
    const actions = ins.actions ?? []
    const spend   = Number(ins.spend ?? 0)

    const pick = (...types: string[]) => {
      const a = actions.find((x: any) => types.includes(x.action_type) && Number(x.value) > 0)
      return a ? Number(a.value) : null
    }

    // Leads — action_types válidos conforme documentação Meta
    const leads = pick(
      "lead",                               // todos os leads (on + off Facebook)
      "onsite_conversion.lead_grouped",     // leads on-Facebook agrupados
      "offsite_conversion.fb_pixel_lead",   // leads via Pixel
    )

    // Conversas WhatsApp / Messenger — action_types válidos
    const conversations = pick(
      "onsite_conversion.messaging_conversation_started_7d",
      "onsite_conversion.messaging_first_reply",
      "onsite_conversion.messaging_welcome_message_view",
    )

    // Engajamento
    const engagements = pick("post_engagement", "page_engagement")

    // Compras: purchase_roas vem como array [{action_type, value}]
    const purchaseRoasEntry = (ins.purchase_roas ?? []).find(
      (x: any) => x.action_type === "omni_purchase" || x.action_type === "offsite_conversion.fb_pixel_purchase"
    )
    const roas = purchaseRoasEntry ? Number(purchaseRoasEntry.value) : null

    // Receita para fallback (action_values)
    const PURCHASE_TYPES = ["omni_purchase", "offsite_conversion.fb_pixel_purchase", "onsite_conversion.purchase"]
    const purchaseRev = (ins.action_values ?? []).find((a: any) => PURCHASE_TYPES.includes(a.action_type))?.value
    const roasFallback = purchaseRev && spend > 0 ? Number(purchaseRev) / spend : null

    const cpl      = leads && spend > 0 ? spend / leads : null
    const cpc_conv = conversations && spend > 0 ? spend / conversations : null
    const cpe      = engagements && spend > 0 ? spend / engagements : null

    return {
      ...c,
      metrics: {
        spend,
        impressions: Number(ins.impressions ?? 0),
        clicks:      Number(ins.clicks ?? 0),
        reach:       Number(ins.reach ?? 0),
        ctr:         Number(ins.ctr ?? 0),
        cpc:         Number(ins.cpc ?? 0),
        cpm:         Number(ins.cpm ?? 0),
        leads,
        cpl,
        conversations,
        cpc_conv,
        engagements,
        cpe,
        roas: roas ?? roasFallback,
      },
    }
  })
}

export async function createCampaign(tenantId: string, params: Record<string, any>) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  const body: Record<string, unknown> = {
    name: params.name,
    objective: params.objective,
    status: params.status ?? "PAUSED",
    special_ad_categories: params.special_ad_categories ?? [],
  }
  if (params.daily_budget)    body.daily_budget    = Math.round(params.daily_budget * 100)
  if (params.lifetime_budget) body.lifetime_budget = Math.round(params.lifetime_budget * 100)
  if (params.start_time) body.start_time = params.start_time
  if (params.stop_time)  body.stop_time  = params.stop_time
  return graphPost(`/act_${adAccountId}/campaigns`, token, body)
}

export async function updateCampaign(tenantId: string, campaignId: string, params: Record<string, unknown>) {
  const token = await getToken(tenantId)
  const body: Record<string, unknown> = { ...params }
  if (typeof body.daily_budget    === "number") body.daily_budget    = Math.round(body.daily_budget * 100)
  if (typeof body.lifetime_budget === "number") body.lifetime_budget = Math.round(body.lifetime_budget * 100)
  return graphPost(`/${campaignId}`, token, body)
}

export async function duplicateCampaign(tenantId: string, campaignId: string, newName?: string) {
  const token = await getToken(tenantId)
  const body: Record<string, unknown> = { deep_copy: true, status_option: "PAUSED" }
  if (newName) body.rename_options = { rename_prefix: newName, rename_suffix: "" }
  return graphPost(`/${campaignId}/copies`, token, body)
}

export async function deleteCampaign(tenantId: string, campaignId: string) {
  const token = await getToken(tenantId)
  return graphDelete(`/${campaignId}`, token)
}

export async function toggleCampaign(tenantId: string, campaignId: string, status: string, connectionId?: string) {
  const { token } = await getTokenAndAccount(tenantId, connectionId)
  return graphPost(`/${campaignId}`, token, { status })
}

export async function updateBudget(tenantId: string, campaignId: string, dailyBudget?: number, lifetimeBudget?: number, connectionId?: string) {
  const { token } = await getTokenAndAccount(tenantId, connectionId)
  const body: Record<string, number> = {}
  if (dailyBudget)    body.daily_budget    = Math.round(dailyBudget * 100)
  if (lifetimeBudget) body.lifetime_budget = Math.round(lifetimeBudget * 100)
  return graphPost(`/${campaignId}`, token, body)
}

// ─── Ad Sets ─────────────────────────────────────────────────────────────────

export async function getAdSets(tenantId: string, campaignId: string, datePreset = "last_7d") {
  const token = await getToken(tenantId)
  const fields = [
    "id,name,status,effective_status",
    "daily_budget,lifetime_budget,budget_remaining",
    "optimization_goal,billing_event,bid_amount,bid_strategy",
    "targeting",
    "start_time,end_time,created_time,updated_time",
    `insights.date_preset(${datePreset}){impressions,reach,clicks,spend,ctr,cpc,cpm,actions,frequency}`,
  ].join(",")
  const data = await graphGet(`/${campaignId}/adsets`, { access_token: token, fields, limit: "50" })
  return data.data ?? []
}

export async function getAdSetById(tenantId: string, adSetId: string) {
  const token = await getToken(tenantId)
  const fields = "id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,targeting,start_time,end_time"
  return graphGet(`/${adSetId}`, { access_token: token, fields })
}

export async function createAdSet(tenantId: string, params: Record<string, any>) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  const body: Record<string, unknown> = {
    campaign_id: params.campaign_id,
    name: params.name,
    optimization_goal: params.optimization_goal,
    billing_event: params.billing_event,
    targeting: params.targeting,
    status: params.status ?? "PAUSED",
  }
  if (params.daily_budget)    body.daily_budget    = Math.round(params.daily_budget * 100)
  if (params.lifetime_budget) body.lifetime_budget = Math.round(params.lifetime_budget * 100)
  if (params.start_time) body.start_time = params.start_time
  if (params.end_time)   body.end_time   = params.end_time
  if (params.bid_amount) body.bid_amount = Math.round(params.bid_amount * 100)
  return graphPost(`/act_${adAccountId}/adsets`, token, body)
}

export async function updateAdSet(tenantId: string, adSetId: string, params: Record<string, unknown>) {
  const token = await getToken(tenantId)
  const body: Record<string, unknown> = { ...params }
  if (typeof body.daily_budget    === "number") body.daily_budget    = Math.round(body.daily_budget * 100)
  if (typeof body.lifetime_budget === "number") body.lifetime_budget = Math.round(body.lifetime_budget * 100)
  return graphPost(`/${adSetId}`, token, body)
}

export async function duplicateAdSet(tenantId: string, adSetId: string, campaignId?: string) {
  const token = await getToken(tenantId)
  const body: Record<string, unknown> = { deep_copy: false, status_option: "PAUSED" }
  if (campaignId) body.campaign_id = campaignId
  return graphPost(`/${adSetId}/copies`, token, body)
}

export async function deleteAdSet(tenantId: string, adSetId: string) {
  const token = await getToken(tenantId)
  return graphDelete(`/${adSetId}`, token)
}

// ─── Ads ─────────────────────────────────────────────────────────────────────

export async function getAds(tenantId: string, campaignId: string, datePreset = "last_7d") {
  const token = await getToken(tenantId)
  const adInsightFields = "impressions,reach,clicks,spend,ctr,cpc,cpm,actions,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions"
  const fields = `id,name,status,creative{id,name,thumbnail_url,body,title,image_url,object_story_spec},insights.date_preset(${datePreset}){${adInsightFields}}`
  const data = await graphGet(`/${campaignId}/ads`, { access_token: token, fields, limit: "50" })
  return (data.data ?? []).map((ad: any) => {
    const c = ad.creative
    if (!c) return ad
    const spec = c.object_story_spec ?? {}
    const video_id = spec.video_data?.video_id ?? null
    const hi_image =
      c.image_url ||
      spec.link_data?.picture ||
      spec.link_data?.image_url ||
      spec.photo_data?.url ||
      null
    return {
      ...ad,
      creative: {
        ...c,
        video_id,
        image_url: hi_image,
        thumbnail_url: c.thumbnail_url ? `${c.thumbnail_url}&access_token=${token}` : null,
      },
    }
  })
}

export async function getVideoSource(tenantId: string, videoId: string) {
  const token = await getToken(tenantId)
  const data = await graphGet(`/${videoId}`, { access_token: token, fields: "source,picture" })
  return { source: data.source ?? null, picture: data.picture ?? null }
}

export async function getAdsByAdSet(tenantId: string, adSetId: string) {
  const token = await getToken(tenantId)
  const fields = "id,name,status,creative{id,name,thumbnail_url,body,title},effective_status"
  const data = await graphGet(`/${adSetId}/ads`, { access_token: token, fields, limit: "50" })
  return data.data ?? []
}

export async function updateAd(tenantId: string, adId: string, params: Record<string, unknown>) {
  const token = await getToken(tenantId)
  return graphPost(`/${adId}`, token, params)
}

export async function duplicateAd(tenantId: string, adId: string, adSetId?: string) {
  const token = await getToken(tenantId)
  const body: Record<string, unknown> = { status_option: "PAUSED" }
  if (adSetId) body.adset_id = adSetId
  return graphPost(`/${adId}/copies`, token, body)
}

export async function deleteAd(tenantId: string, adId: string) {
  const token = await getToken(tenantId)
  return graphDelete(`/${adId}`, token)
}

// UTM default tags injected on every ad unless overridden
const DEFAULT_UTM_TAGS = "utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{adset.name}}&utm_term={{ad.name}}&fbclid={{fbclid}}"

export async function createAd(tenantId: string, params: Record<string, any>) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  const creative: Record<string, any> = {}

  if (params.creative_id) {
    creative.creative_id = params.creative_id
  } else {
    const spec: Record<string, any> = {}
    if (params.page_id) {
      const linkData: Record<string, any> = {
        message: params.body ?? params.message,
        name:    params.headline,
        link:    params.link_url ?? params.website_url ?? "https://facebook.com",
        call_to_action: { type: params.cta ?? "LEARN_MORE" },
      }
      if (params.image_hash)  linkData.image_hash = params.image_hash
      if (params.caption)     linkData.caption    = params.caption
      if (params.description) linkData.description = params.description

      if (params.video_id) {
        spec.video_data = {
          video_id:    params.video_id,
          title:       params.headline,
          message:     params.body ?? params.message,
          call_to_action: { type: params.cta ?? "LEARN_MORE", value: { link: params.link_url ?? params.website_url } },
        }
      } else {
        spec.link_data = linkData
      }
      spec.page_id = params.page_id
      if (params.instagram_actor_id) spec.instagram_actor_id = params.instagram_actor_id
    }
    creative.name              = params.creative_name ?? params.name
    creative.object_story_spec = spec
  }

  const body: Record<string, any> = {
    name:      params.name,
    adset_id:  params.adset_id,
    creative,
    status:    params.status ?? "PAUSED",
    // Inject UTM tags automatically unless caller provides them
    tracking_specs: params.tracking_specs ?? undefined,
  }

  // url_tags injects UTM params into all destination URLs in the creative
  if (!params.url_tags && !params.skip_utm) {
    body.url_tags = params.utm_tags ?? DEFAULT_UTM_TAGS
  }

  const { creative: _c, ...adBody } = body
  const creativeRes = await graphPost(`/act_${adAccountId}/adcreatives`, token, creative)
  adBody.creative = { creative_id: creativeRes.id }
  return graphPost(`/act_${adAccountId}/ads`, token, adBody)
}

// ─── Insights ────────────────────────────────────────────────────────────────

// website_ctr removido (não é campo raiz); purchase_roas adicionado para ROAS real
const INSIGHT_FIELDS = "impressions,clicks,spend,reach,ctr,cpm,cpc,actions,action_values,purchase_roas,frequency,cost_per_action_type,video_avg_time_watched_actions,outbound_clicks"

export async function getInsights(tenantId: string, datePreset = "last_7d", since?: string, until?: string) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  const params: Record<string, string> = { access_token: token, fields: INSIGHT_FIELDS, level: "account" }
  if (since && until) {
    params.time_range = JSON.stringify({ since, until })
  } else {
    params.date_preset = datePreset
  }
  const data = await graphGet(`/act_${adAccountId}/insights`, params)
  return data.data?.[0] ?? {}
}

export async function getCampaignInsights(tenantId: string, campaignId: string, datePreset = "last_7d") {
  const token = await getToken(tenantId)
  const data = await graphGet(`/${campaignId}/insights`, {
    access_token: token, fields: INSIGHT_FIELDS, date_preset: datePreset,
  })
  return data.data?.[0] ?? {}
}

export async function getAdSetInsights(tenantId: string, adSetId: string, datePreset = "last_7d") {
  const token = await getToken(tenantId)
  const data = await graphGet(`/${adSetId}/insights`, {
    access_token: token, fields: INSIGHT_FIELDS, date_preset: datePreset,
  })
  return data.data?.[0] ?? {}
}

export async function getAdInsights(tenantId: string, adId: string, datePreset = "last_7d") {
  const token = await getToken(tenantId)
  const data = await graphGet(`/${adId}/insights`, {
    access_token: token, fields: INSIGHT_FIELDS, date_preset: datePreset,
  })
  return data.data?.[0] ?? {}
}

export async function getInsightsByBreakdown(tenantId: string, breakdown: string, datePreset = "last_7d") {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  const data = await graphGet(`/act_${adAccountId}/insights`, {
    access_token: token,
    fields: "impressions,clicks,spend,ctr,cpc,actions",
    date_preset: datePreset,
    breakdowns: breakdown,
    level: "account",
  })
  return data.data ?? []
}

// ─── Pixel ───────────────────────────────────────────────────────────────────

export async function getPixels(tenantId: string) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  const data = await graphGet(`/act_${adAccountId}/adspixels`, {
    access_token: token,
    fields: "id,name,creation_time,last_fired_time,code",
  })
  return data.data ?? []
}

export async function getPixelStats(tenantId: string, pixelId: string, datePreset = "last_7d") {
  const token = await getToken(tenantId)
  const now = Math.floor(Date.now() / 1000)
  const sevenDaysAgo = now - 7 * 24 * 3600
  const data = await graphGet(`/${pixelId}/stats`, {
    access_token: token,
    start_time: String(sevenDaysAgo),
    end_time: String(now),
    aggregation: "event",
  })
  return data.data ?? []
}

export async function getCustomConversions(tenantId: string) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  const data = await graphGet(`/act_${adAccountId}/customconversions`, {
    access_token: token,
    fields: "id,name,event_source_type,last_fired_time,creation_time",
  })
  return data.data ?? []
}

// ─── Audiences ───────────────────────────────────────────────────────────────

export async function getCustomAudiences(tenantId: string) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  const data = await graphGet(`/act_${adAccountId}/customaudiences`, {
    access_token: token,
    fields: "id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,operation_status,time_created",
  })
  return data.data ?? []
}

export async function createWebsiteAudience(tenantId: string, params: {
  name: string
  pixel_id: string
  retention_days: number
  event?: string  // "ViewContent" | "Purchase" | "Lead" | "PageView" (default)
}) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  const evt = params.event ?? "PageView"
  const rule = {
    inclusions: {
      operator: "or",
      rules: [{
        event_sources: [{ id: params.pixel_id, type: "pixel" }],
        retention_seconds: params.retention_days * 86400,
        filter: { operator: "and", filters: [{ field: "event", operator: "eq", value: evt }] },
      }],
    },
  }
  return graphPost(`/act_${adAccountId}/customaudiences`, token, {
    name:        params.name,
    subtype:     "WEBSITE",
    description: "Criado pelo GTPRO",
    pixel_id:    params.pixel_id,
    rule:        JSON.stringify(rule),
  })
}

export async function createEngagementAudience(tenantId: string, params: {
  name: string
  page_id: string
  retention_days: number
  engagement_type?: "PAGE_VISITED" | "PAGE_LIKED" | "PAGE_ENGAGED" | "PAGE_CTA_CLICKED"
}) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  const engType = params.engagement_type ?? "PAGE_ENGAGED"
  return graphPost(`/act_${adAccountId}/customaudiences`, token, {
    name:        params.name,
    subtype:     "ENGAGEMENT",
    description: "Criado pelo GTPRO",
    retention_days: params.retention_days,
    rule: JSON.stringify({
      inclusions: {
        operator: "or",
        rules: [{
          event_sources: [{ id: params.page_id, type: "page" }],
          retention_seconds: params.retention_days * 86400,
          filter: { operator: "and", filters: [{ field: "event", operator: "eq", value: engType }] },
        }],
      },
    }),
  })
}

export async function createLookalikeAudience(tenantId: string, params: Record<string, any>) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  return graphPost(`/act_${adAccountId}/customaudiences`, token, {
    name: params.name,
    subtype: "LOOKALIKE",
    origin_audience_id: params.source_audience_id,
    lookalike_spec: {
      type: "similarity",
      ratio: params.ratio ?? 0.01,
      country: params.country,
    },
  })
}

// ─── Campaign Breakdowns ─────────────────────────────────────────────────────

export async function getCampaignBreakdowns(tenantId: string, campaignId: string, breakdown: string, datePreset = "last_7d") {
  const token = await getToken(tenantId)
  const data = await graphGet(`/${campaignId}/insights`, {
    access_token: token,
    fields: "impressions,reach,clicks,spend,ctr,cpc,actions",
    date_preset: datePreset,
    breakdowns: breakdown,
    limit: "500",
  })
  return data.data ?? []
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const appId = await getMetaAppId()
  const appSecret = await getMetaAppSecret()
  return graphGet("/oauth/access_token", { client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code })
}

export async function getLongLivedToken(shortToken: string) {
  const appId = await getMetaAppId()
  const appSecret = await getMetaAppSecret()
  return graphGet("/oauth/access_token", {
    grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: shortToken,
  })
}

export async function getAdAccounts(accessToken: string) {
  const data = await graphGet("/me/adaccounts", {
    access_token: accessToken,
    fields: "id,name,account_status,currency,timezone_name,business_name",
  })
  return data.data ?? []
}

export async function saveMetaConnection(tenantId: string, accessToken: string, adAccountId: string) {
  const supabase = createServiceClient()
  // Desativa todas as conexões existentes
  await supabase.from("meta_connections").update({ is_active: false }).eq("tenant_id", tenantId)
  // Verifica se já existe uma conexão com esse ad_account_id
  const { data: existing } = await supabase.from("meta_connections")
    .select("id").eq("tenant_id", tenantId).eq("ad_account_id", adAccountId).single()
  if (existing) {
    await supabase.from("meta_connections")
      .update({ access_token_encrypted: encrypt(accessToken), active: true, is_active: true })
      .eq("id", existing.id)
  } else {
    await supabase.from("meta_connections").insert(
      { tenant_id: tenantId, access_token_encrypted: encrypt(accessToken), ad_account_id: adAccountId, active: true, is_active: true }
    )
  }
}

export { encrypt, getToken }

// ─── Smart campaign filter for AI agents ─────────────────────────────────────
// Top 15 active (by spend) + top 5 paused with actual results (so the agent
// can surface "you paused a high-performing campaign" insights).
// Anything else (archived, zero-spend active, ancient paused) is excluded.
// datePreset used to label the paused note — campaigns with spend > 0 in the
// period were actually running during that period, regardless of current status.
export function filterCampaignsForAgent(
  campaigns: any[],
  includeInactive = false,
  _datePreset = "last_7d",
): any[] {
  const active = campaigns
    .filter(c => c.status === "ACTIVE" && (c.metrics?.spend ?? 0) > 0)
    .sort((a, b) => (b.metrics?.spend ?? 0) - (a.metrics?.spend ?? 0))
    .slice(0, 20)

  if (!includeInactive) return active

  const efficiencyScore = (c: any): number => {
    const m   = c.metrics
    const obj = (c.objective ?? "").toUpperCase()
    const SALES_OBJ = ["OUTCOME_SALES", "PRODUCT_CATALOG_SALES", "CONVERSIONS"]
    if (SALES_OBJ.includes(obj)) return (m.roas ?? 0) * 1000
    if (m.cpl      && m.cpl      > 0) return 10000 / m.cpl
    if (m.cpc_conv && m.cpc_conv > 0) return 1000  / m.cpc_conv
    return m.spend ?? 0
  }

  // Only include paused campaigns that had spend in the selected period
  const paused = campaigns
    .filter(c => c.status === "PAUSED" && (c.metrics?.spend ?? 0) > 0)
    .sort((a, b) => efficiencyScore(b) - efficiencyScore(a))
    .slice(0, 5)
    .map(c => ({ ...c, _agent_note: "PAUSADA — rodou e teve resultado neste período" }))

  return [...active, ...paused]
}
