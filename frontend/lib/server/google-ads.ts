import { createServiceClient } from "./supabase"
import { decrypt, encrypt } from "./crypto"
import { getGoogleClientId, getGoogleClientSecret, getGoogleDeveloperToken } from "./platform"

const OAUTH_BASE  = "https://oauth2.googleapis.com"
const ADS_BASE    = "https://googleads.googleapis.com/v18"

// ─── OAuth helpers ────────────────────────────────────────────────────────────

export async function getGoogleOAuthUrl(state: string, redirectUri: string): Promise<string> {
  const clientId = await getGoogleClientId()
  if (!clientId) throw new Error("Google Client ID não configurado. Configure em Admin → Configurações.")
  const params = new URLSearchParams({
    client_id:     clientId,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         "https://www.googleapis.com/auth/adwords",
    access_type:   "offline",
    prompt:        "consent",
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeGoogleCode(code: string, redirectUri: string) {
  const [clientId, clientSecret] = await Promise.all([getGoogleClientId(), getGoogleClientSecret()])
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description ?? data.error)
  return data as { access_token: string; refresh_token: string; expires_in: number }
}

async function refreshGoogleToken(refreshToken: string): Promise<string> {
  const [clientId, clientSecret] = await Promise.all([getGoogleClientId(), getGoogleClientSecret()])
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error_description ?? data.error)
  return data.access_token
}

// ─── API request helper ───────────────────────────────────────────────────────

async function gadsPost(path: string, body: unknown, accessToken: string, managerCustomerId?: string) {
  const devToken = await getGoogleDeveloperToken()
  const headers: Record<string, string> = {
    "Content-Type":  "application/json",
    "Authorization": `Bearer ${accessToken}`,
    "developer-token": devToken,
  }
  if (managerCustomerId) headers["login-customer-id"] = managerCustomerId

  const res = await fetch(`${ADS_BASE}${path}`, { method: "POST", headers, body: JSON.stringify(body) })
  let data: any
  try {
    data = await res.json()
  } catch {
    const text = await res.text().catch(() => "")
    throw new Error(`Google Ads API ${res.status}: ${text.slice(0, 300)}`)
  }
  if (!res.ok) {
    const msg = data?.error?.message ?? data?.error?.details?.[0]?.errors?.[0]?.message ?? JSON.stringify(data)
    throw new Error(msg)
  }
  return data
}

// ─── Token management ─────────────────────────────────────────────────────────

async function getTokens(tenantId: string): Promise<{ accessToken: string; conn: any }> {
  const supabase = createServiceClient()
  const { data: conn } = await supabase
    .from("google_connections")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single()
  if (!conn) throw new Error("Conta Google Ads não conectada. Conecte em Configurações → Google Ads.")

  const refreshToken = decrypt(conn.refresh_token_encrypted)
  const accessToken  = await refreshGoogleToken(refreshToken)
  return { accessToken, conn }
}

// ─── Account discovery ────────────────────────────────────────────────────────

export async function listAccessibleCustomers(accessToken: string): Promise<{ resourceName: string; id: string }[]> {
  const devToken = await getGoogleDeveloperToken()
  const res = await fetch(`${ADS_BASE}/customers:listAccessibleCustomers`, {
    headers: { Authorization: `Bearer ${accessToken}`, "developer-token": devToken },
  })
  let data: any
  try {
    data = await res.json()
  } catch {
    const text = await res.text().catch(() => "")
    throw new Error(`Google Ads API ${res.status}: ${text.slice(0, 300)}`)
  }
  if (!res.ok) throw new Error(data?.error?.message ?? data?.error?.details?.[0]?.errors?.[0]?.message ?? JSON.stringify(data))
  return (data.resourceNames ?? []).map((r: string) => ({ resourceName: r, id: r.replace("customers/", "") }))
}

export async function getCustomerInfo(customerId: string, accessToken: string, managerCustomerId?: string) {
  const query = `SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.manager FROM customer WHERE customer.id = ${customerId}`
  const data  = await gadsPost(`/customers/${customerId}/googleAds:search`, { query }, accessToken, managerCustomerId)
  return data.results?.[0]?.customer ?? null
}

export async function saveGoogleConnections(
  tenantId: string,
  accessToken: string,
  refreshToken: string,
  customers: { id: string; name: string; currencyCode: string; isManager: boolean }[],
  managerCustomerId?: string,
) {
  const supabase = createServiceClient()
  // Deactivate existing
  await supabase.from("google_connections").update({ is_active: false }).eq("tenant_id", tenantId)

  const rows = customers.map((c, i) => ({
    tenant_id:               tenantId,
    customer_id:             c.id,
    customer_name:           c.name,
    currency_code:           c.currencyCode,
    access_token_encrypted:  encrypt(accessToken),
    refresh_token_encrypted: encrypt(refreshToken),
    manager_customer_id:     managerCustomerId ?? null,
    is_active:               i === 0,
    active:                  true,
  }))

  await supabase.from("google_connections").upsert(rows, { onConflict: "tenant_id,customer_id" })
  return rows
}

export async function getGoogleConnections(tenantId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("google_connections")
    .select("id,customer_id,customer_name,currency_code,is_active,manager_customer_id,created_at")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("is_active", { ascending: false })
  return data ?? []
}

export async function switchGoogleConnection(tenantId: string, id: string) {
  const supabase = createServiceClient()
  await supabase.from("google_connections").update({ is_active: false }).eq("tenant_id", tenantId)
  await supabase.from("google_connections").update({ is_active: true }).eq("id", id).eq("tenant_id", tenantId)
}

// ─── Campaigns ────────────────────────────────────────────────────────────────

const DATE_RANGES: Record<string, string> = {
  last_7d:  "LAST_7_DAYS",
  last_14d: "LAST_14_DAYS",
  last_30d: "LAST_30_DAYS",
  last_90d: "LAST_90_DAYS",
  this_month: "THIS_MONTH",
  last_month: "LAST_MONTH",
}

export async function getGoogleCampaigns(tenantId: string, datePreset = "last_7d") {
  const { accessToken, conn } = await getTokens(tenantId)
  const dateRange = DATE_RANGES[datePreset] ?? "LAST_7_DAYS"

  const query = `
    SELECT
      campaign.id,
      campaign.name,
      campaign.status,
      campaign.advertising_channel_type,
      campaign.bidding_strategy_type,
      campaign.start_date,
      campaign.end_date,
      campaign_budget.amount_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      metrics.search_impression_share
    FROM campaign
    WHERE segments.date DURING ${dateRange}
      AND campaign.status != 'REMOVED'
    ORDER BY metrics.cost_micros DESC
    LIMIT 100
  `

  const data = await gadsPost(
    `/customers/${conn.customer_id}/googleAds:search`,
    { query },
    accessToken,
    conn.manager_customer_id,
  )

  return (data.results ?? []).map((r: any) => {
    const c = r.campaign
    const b = r.campaignBudget
    const m = r.metrics
    const spend = (m?.costMicros ?? 0) / 1_000_000
    const conversions = Number(m?.conversions ?? 0)
    const convValue   = Number(m?.conversionsValue ?? 0)
    return {
      id:           c.id,
      name:         c.name,
      status:       c.status,
      channel_type: c.advertisingChannelType,
      budget:       b ? (b.amountMicros / 1_000_000) : null,
      impressions:  Number(m?.impressions ?? 0),
      clicks:       Number(m?.clicks ?? 0),
      spend,
      conversions,
      conv_value:   convValue,
      ctr:          Number(m?.ctr ?? 0),
      avg_cpc:      (m?.averageCpc ?? 0) / 1_000_000,
      roas:         spend > 0 ? convValue / spend : null,
      cpa:          conversions > 0 ? spend / conversions : null,
      currency:     conn.currency_code ?? "BRL",
    }
  })
}

export async function toggleGoogleCampaign(tenantId: string, campaignId: string, enable: boolean) {
  const { accessToken, conn } = await getTokens(tenantId)
  return gadsPost(
    `/customers/${conn.customer_id}/campaigns:mutate`,
    { operations: [{ update: { resourceName: `customers/${conn.customer_id}/campaigns/${campaignId}`, status: enable ? "ENABLED" : "PAUSED" }, updateMask: "status" }] },
    accessToken,
    conn.manager_customer_id,
  )
}

export async function updateGoogleCampaignBudget(tenantId: string, budgetId: string, amountMicros: number) {
  const { accessToken, conn } = await getTokens(tenantId)
  return gadsPost(
    `/customers/${conn.customer_id}/campaignBudgets:mutate`,
    { operations: [{ update: { resourceName: `customers/${conn.customer_id}/campaignBudgets/${budgetId}`, amountMicros }, updateMask: "amount_micros" }] },
    accessToken,
    conn.manager_customer_id,
  )
}

// ─── Insights ─────────────────────────────────────────────────────────────────

export async function getGoogleInsights(tenantId: string, datePreset = "last_7d") {
  const { accessToken, conn } = await getTokens(tenantId)
  const dateRange = DATE_RANGES[datePreset] ?? "LAST_7_DAYS"

  const query = `
    SELECT
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.conversions_value,
      metrics.ctr,
      metrics.average_cpc,
      segments.date
    FROM customer
    WHERE segments.date DURING ${dateRange}
    ORDER BY segments.date DESC
  `

  const data = await gadsPost(
    `/customers/${conn.customer_id}/googleAds:search`,
    { query },
    accessToken,
    conn.manager_customer_id,
  )

  const results = data.results ?? []
  const totals = results.reduce((acc: any, r: any) => {
    const m = r.metrics
    acc.impressions  += Number(m?.impressions ?? 0)
    acc.clicks       += Number(m?.clicks ?? 0)
    acc.spend        += (m?.costMicros ?? 0) / 1_000_000
    acc.conversions  += Number(m?.conversions ?? 0)
    acc.conv_value   += Number(m?.conversionsValue ?? 0)
    return acc
  }, { impressions: 0, clicks: 0, spend: 0, conversions: 0, conv_value: 0 })

  const daily = results.map((r: any) => ({
    date:        r.segments?.date,
    impressions: Number(r.metrics?.impressions ?? 0),
    clicks:      Number(r.metrics?.clicks ?? 0),
    spend:       (r.metrics?.costMicros ?? 0) / 1_000_000,
    conversions: Number(r.metrics?.conversions ?? 0),
  }))

  return {
    ...totals,
    roas:    totals.spend > 0 ? totals.conv_value / totals.spend : null,
    ctr:     totals.impressions > 0 ? totals.clicks / totals.impressions : null,
    avg_cpc: totals.clicks > 0 ? totals.spend / totals.clicks : null,
    cpa:     totals.conversions > 0 ? totals.spend / totals.conversions : null,
    daily,
    currency: conn.currency_code ?? "BRL",
  }
}

// ─── Alerts check ─────────────────────────────────────────────────────────────

export async function checkGoogleAlerts(tenantId: string) {
  const campaigns = await getGoogleCampaigns(tenantId, "last_7d")
  const alerts: { type: string; message: string; campaign_id: string }[] = []

  for (const c of campaigns) {
    if (c.status !== "ENABLED") continue
    if (c.roas !== null && c.roas < 1 && c.spend > 50)
      alerts.push({ type: "low_roas", message: `Campanha "${c.name}" com ROAS de ${c.roas.toFixed(2)} (abaixo de 1)`, campaign_id: c.id })
    if (c.ctr !== null && c.ctr < 0.005 && c.impressions > 1000)
      alerts.push({ type: "low_ctr", message: `Campanha "${c.name}" com CTR baixo: ${(c.ctr * 100).toFixed(2)}%`, campaign_id: c.id })
  }
  return alerts
}
