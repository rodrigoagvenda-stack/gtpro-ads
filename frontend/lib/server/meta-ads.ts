import { createServiceClient } from "./supabase"
import { decrypt, encrypt } from "./crypto"
import { getMetaAppId, getMetaAppSecret } from "./platform"

const GRAPH = "https://graph.facebook.com/v20.0"

async function getToken(tenantId: string): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("meta_connections")
    .select("access_token_encrypted")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .eq("is_active", true)
    .single()
  if (!data) throw new Error("Conta Meta não conectada")
  return decrypt(data.access_token_encrypted)
}

async function getAdAccountId(tenantId: string): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("meta_connections")
    .select("ad_account_id")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .eq("is_active", true)
    .single()
  if (!data) throw new Error("Conta Meta não conectada")
  return data.ad_account_id
}

async function getTokenAndAccount(tenantId: string) {
  const [token, adAccountId] = await Promise.all([getToken(tenantId), getAdAccountId(tenantId)])
  return { token, adAccountId }
}

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(await res.text())
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
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

async function graphDelete(path: string, token: string) {
  const url = new URL(`${GRAPH}${path}`)
  url.searchParams.set("access_token", token)
  const res = await fetch(url.toString(), { method: "DELETE" })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

// ─── Account ────────────────────────────────────────────────────────────────

export async function getAccountInfo(tenantId: string) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  const fields = "id,name,account_status,currency,timezone_name,spend_cap,amount_spent,balance,funding_source_details"
  return graphGet(`/act_${adAccountId}`, { access_token: token, fields })
}

// ─── Campaigns ──────────────────────────────────────────────────────────────

export async function getCampaigns(tenantId: string) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  const fields = "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,budget_remaining,buying_type"
  const data = await graphGet(`/act_${adAccountId}/campaigns`, { access_token: token, fields, limit: "100" })
  return data.data ?? []
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

export async function toggleCampaign(tenantId: string, campaignId: string, status: string) {
  const token = await getToken(tenantId)
  return graphPost(`/${campaignId}`, token, { status })
}

export async function updateBudget(tenantId: string, campaignId: string, dailyBudget?: number, lifetimeBudget?: number) {
  const token = await getToken(tenantId)
  const body: Record<string, number> = {}
  if (dailyBudget)    body.daily_budget    = Math.round(dailyBudget * 100)
  if (lifetimeBudget) body.lifetime_budget = Math.round(lifetimeBudget * 100)
  return graphPost(`/${campaignId}`, token, body)
}

// ─── Ad Sets ─────────────────────────────────────────────────────────────────

export async function getAdSets(tenantId: string, campaignId: string) {
  const token = await getToken(tenantId)
  const fields = "id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount,targeting,start_time,end_time,budget_remaining"
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

export async function getAds(tenantId: string, campaignId: string) {
  const token = await getToken(tenantId)
  const fields = "id,name,status,creative{id,name,thumbnail_url,body,title,image_url,object_story_spec}"
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

// ─── Insights ────────────────────────────────────────────────────────────────

const INSIGHT_FIELDS = "impressions,clicks,spend,reach,ctr,cpm,cpc,actions,action_values,frequency,cost_per_action_type,video_avg_time_watched_actions,website_ctr"

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
  const data = await graphGet(`/${pixelId}/stats`, {
    access_token: token,
    start_time: "0",
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
    fields: "id,name,subtype,approximate_count,operation_status,time_created",
  })
  return data.data ?? []
}

export async function createLookalikeAudience(tenantId: string, params: Record<string, any>) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)
  return graphPost(`/act_${adAccountId}/customaudiences`, token, {
    name: params.name,
    subtype: "LOOKALIKE",
    origin_audience_id: params.source_audience_id,
    lookalike_spec: JSON.stringify({
      type: "similarity",
      ratio: params.ratio ?? 0.01,
      country: params.country,
    }),
  })
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
    fields: "id,name,account_id,account_status,currency",
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
