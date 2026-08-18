import { createServiceClient } from "./supabase"
import { decrypt, encrypt } from "./crypto"
import { refreshGoogleToken } from "./google-ads"

const ADMIN_API = "https://analyticsadmin.googleapis.com/v1beta"
const DATA_API   = "https://analyticsdata.googleapis.com/v1beta"

async function gaGet(url: string, accessToken: string) {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) {
    const raw = await res.text()
    console.error(`[ga4] GET ${url} FAILED status=${res.status}:`, raw)
    throw new Error(`Erro na API do Google Analytics (${res.status}): ${raw.slice(0, 300)}`)
  }
  return res.json()
}

async function gaPost(url: string, accessToken: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const raw = await res.text()
    console.error(`[ga4] POST ${url} FAILED status=${res.status}:`, raw)
    throw new Error(`Erro na API do Google Analytics (${res.status}): ${raw.slice(0, 300)}`)
  }
  return res.json()
}

// ─── Property discovery ────────────────────────────────────────────────────────

export interface GA4Property {
  propertyId:   string   // ex: "properties/123456789" → guardamos só o numero
  propertyName: string
  accountName:  string
}

// accountSummaries retorna a hierarquia inteira (contas + propriedades) em uma
// unica chamada — equivalente ao customer_client do Google Ads.
export async function listGA4Properties(accessToken: string): Promise<GA4Property[]> {
  const data = await gaGet(`${ADMIN_API}/accountSummaries?pageSize=200`, accessToken)
  const out: GA4Property[] = []
  for (const acc of data.accountSummaries ?? []) {
    for (const p of acc.propertySummaries ?? []) {
      out.push({
        propertyId:   String(p.property ?? "").replace("properties/", ""),
        propertyName: p.displayName || p.property,
        accountName:  acc.displayName || acc.account,
      })
    }
  }
  return out
}

// ─── Connections table ──────────────────────────────────────────────────────────

export async function saveGA4Connections(
  tenantId: string,
  accessToken: string,
  refreshToken: string,
  properties: GA4Property[],
) {
  const supabase = createServiceClient()
  await supabase.from("ga4_connections").update({ is_active: false }).eq("tenant_id", tenantId)

  for (let i = 0; i < properties.length; i++) {
    const p = properties[i]
    const { data: existing } = await supabase
      .from("ga4_connections")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("property_id", p.propertyId)
      .single()

    const row = {
      tenant_id:               tenantId,
      property_id:             p.propertyId,
      property_name:           p.propertyName,
      account_name:            p.accountName,
      access_token_encrypted:  encrypt(accessToken),
      refresh_token_encrypted: encrypt(refreshToken),
      is_active:               i === 0,
      active:                  true,
    }
    if (existing) {
      await supabase.from("ga4_connections").update(row).eq("id", existing.id)
    } else {
      await supabase.from("ga4_connections").insert(row)
    }
  }
}

export async function getGA4Connections(tenantId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("ga4_connections")
    .select("id, property_id, property_name, account_name, is_active, created_at")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("is_active", { ascending: false })
  return data ?? []
}

export async function switchGA4Connection(tenantId: string, id: string) {
  const supabase = createServiceClient()
  await supabase.from("ga4_connections").update({ is_active: false }).eq("tenant_id", tenantId)
  await supabase.from("ga4_connections").update({ is_active: true }).eq("id", id).eq("tenant_id", tenantId)
}

async function getActiveProperty(tenantId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("ga4_connections")
    .select("property_id, access_token_encrypted, refresh_token_encrypted")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .eq("is_active", true)
    .single()
  if (!data) throw new Error("Conta Google Analytics (GA4) não conectada. Conecte em Configurações → Google Ads (mesmo fluxo OAuth).")
  const accessToken = await refreshGoogleToken(decrypt(data.refresh_token_encrypted))
  return { propertyId: data.property_id, accessToken }
}

// ─── Reports ─────────────────────────────────────────────────────────────────

const DATE_RANGES: Record<string, { startDate: string; endDate: string }> = {
  today:      { startDate: "today",     endDate: "today" },
  yesterday:  { startDate: "yesterday", endDate: "yesterday" },
  last_7d:    { startDate: "7daysAgo",  endDate: "today" },
  last_14d:   { startDate: "14daysAgo", endDate: "today" },
  last_30d:   { startDate: "30daysAgo", endDate: "today" },
  last_month: { startDate: "30daysAgo", endDate: "today" },
}

// GA4 não tem alias relativo pra "mês atual" — calculamos a data explicitamente.
function resolveDateRange(datePreset: string) {
  if (datePreset === "this_month") {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    return { startDate: start, endDate: "today" }
  }
  return DATE_RANGES[datePreset] ?? DATE_RANGES.last_7d
}

// Visão geral: sessões, usuários, conversões, taxa de engajamento por canal.
export async function getGA4Overview(tenantId: string, datePreset = "last_7d") {
  const { propertyId, accessToken } = await getActiveProperty(tenantId)
  const dateRange = resolveDateRange(datePreset)

  const data = await gaPost(`${DATA_API}/properties/${propertyId}:runReport`, accessToken, {
    dateRanges: [dateRange],
    dimensions: [{ name: "sessionDefaultChannelGroup" }],
    metrics: [
      { name: "sessions" },
      { name: "totalUsers" },
      { name: "newUsers" },
      { name: "conversions" },
      { name: "engagementRate" },
      { name: "averageSessionDuration" },
    ],
    orderBys: [{ metric: { metricName: "sessions" }, desc: true }],
    limit: 20,
  })

  const rows = (data.rows ?? []).map((r: any) => ({
    channel:          r.dimensionValues?.[0]?.value ?? "(não definido)",
    sessions:         Number(r.metricValues?.[0]?.value ?? 0),
    total_users:      Number(r.metricValues?.[1]?.value ?? 0),
    new_users:        Number(r.metricValues?.[2]?.value ?? 0),
    conversions:      Number(r.metricValues?.[3]?.value ?? 0),
    engagement_rate:  Number(r.metricValues?.[4]?.value ?? 0),
    avg_session_secs: Number(r.metricValues?.[5]?.value ?? 0),
  }))

  const totals = rows.reduce((acc: any, r: any) => {
    acc.sessions += r.sessions; acc.total_users += r.total_users
    acc.new_users += r.new_users; acc.conversions += r.conversions
    return acc
  }, { sessions: 0, total_users: 0, new_users: 0, conversions: 0 })

  return { by_channel: rows, totals, date_range: dateRange, _period: datePreset }
}

// Conversões/eventos-chave por dia — util pra ver tendência.
export async function getGA4ConversionsDaily(tenantId: string, datePreset = "last_30d") {
  const { propertyId, accessToken } = await getActiveProperty(tenantId)
  const dateRange = resolveDateRange(datePreset)

  const data = await gaPost(`${DATA_API}/properties/${propertyId}:runReport`, accessToken, {
    dateRanges: [dateRange],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "sessions" }, { name: "conversions" }, { name: "totalRevenue" }],
    orderBys: [{ dimension: { dimensionName: "date" } }],
  })

  return (data.rows ?? []).map((r: any) => ({
    date:        r.dimensionValues?.[0]?.value,
    sessions:    Number(r.metricValues?.[0]?.value ?? 0),
    conversions: Number(r.metricValues?.[1]?.value ?? 0),
    revenue:     Number(r.metricValues?.[2]?.value ?? 0),
  }))
}

// Top páginas de destino — util pra cruzar com campanhas.
export async function getGA4TopPages(tenantId: string, datePreset = "last_7d") {
  const { propertyId, accessToken } = await getActiveProperty(tenantId)
  const dateRange = resolveDateRange(datePreset)

  const data = await gaPost(`${DATA_API}/properties/${propertyId}:runReport`, accessToken, {
    dateRanges: [dateRange],
    dimensions: [{ name: "pagePath" }],
    metrics: [{ name: "screenPageViews" }, { name: "sessions" }, { name: "conversions" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 15,
  })

  return (data.rows ?? []).map((r: any) => ({
    page:        r.dimensionValues?.[0]?.value,
    page_views:  Number(r.metricValues?.[0]?.value ?? 0),
    sessions:    Number(r.metricValues?.[1]?.value ?? 0),
    conversions: Number(r.metricValues?.[2]?.value ?? 0),
  }))
}
