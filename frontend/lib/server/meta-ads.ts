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
    .single()
  if (!data) throw new Error("Conta Meta não conectada")
  return data.ad_account_id
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

export async function getCampaigns(tenantId: string) {
  const token = await getToken(tenantId)
  const adAccountId = await getAdAccountId(tenantId)
  const fields = "id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time"
  const data = await graphGet(`/act_${adAccountId}/campaigns`, { access_token: token, fields, limit: "100" })
  return data.data ?? []
}

export async function getInsights(tenantId: string, datePreset = "last_7d") {
  const token = await getToken(tenantId)
  const adAccountId = await getAdAccountId(tenantId)
  const fields = "impressions,clicks,spend,reach,ctr,cpm,cpc,actions,action_values"
  const data = await graphGet(`/act_${adAccountId}/insights`, {
    access_token: token, fields, date_preset: datePreset, level: "account",
  })
  return data.data?.[0] ?? {}
}

export async function toggleCampaign(tenantId: string, campaignId: string, status: string) {
  const token = await getToken(tenantId)
  return graphPost(`/${campaignId}`, token, { status })
}

export async function updateBudget(tenantId: string, campaignId: string, dailyBudget?: number, lifetimeBudget?: number) {
  const token = await getToken(tenantId)
  const body: Record<string, number> = {}
  if (dailyBudget) body.daily_budget = Math.round(dailyBudget * 100)
  if (lifetimeBudget) body.lifetime_budget = Math.round(lifetimeBudget * 100)
  return graphPost(`/${campaignId}`, token, body)
}

export async function exchangeCodeForToken(code: string, redirectUri: string) {
  const appId = await getMetaAppId()
  const appSecret = await getMetaAppSecret()
  const data = await graphGet("/oauth/access_token", {
    client_id: appId, client_secret: appSecret, redirect_uri: redirectUri, code,
  })
  return data
}

export async function getLongLivedToken(shortToken: string) {
  const appId = await getMetaAppId()
  const appSecret = await getMetaAppSecret()
  const data = await graphGet("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortToken,
  })
  return data
}

export async function getAdSets(tenantId: string, campaignId: string) {
  const token = await getToken(tenantId)
  const fields = "id,name,status,daily_budget,lifetime_budget,optimization_goal,billing_event,bid_amount"
  const data = await graphGet(`/${campaignId}/adsets`, { access_token: token, fields, limit: "50" })
  return data.data ?? []
}

export async function getCampaignInsights(tenantId: string, campaignId: string, datePreset = "last_7d") {
  const token = await getToken(tenantId)
  const fields = "impressions,clicks,spend,reach,ctr,cpm,cpc,actions,action_values,frequency"
  const data = await graphGet(`/${campaignId}/insights`, {
    access_token: token, fields, date_preset: datePreset,
  })
  return data.data?.[0] ?? {}
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
  await supabase.from("meta_connections").upsert(
    {
      tenant_id: tenantId,
      access_token_encrypted: encrypt(accessToken),
      ad_account_id: adAccountId,
      active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tenant_id" }
  )
}

export { encrypt, getToken }
