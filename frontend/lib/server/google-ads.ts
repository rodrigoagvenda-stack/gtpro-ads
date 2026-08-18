import { createServiceClient } from "./supabase"
import { decrypt, encrypt } from "./crypto"
import { getGoogleClientId, getGoogleClientSecret, getGoogleDeveloperToken } from "./platform"

const OAUTH_BASE  = "https://oauth2.googleapis.com"
// Configurável via env GOOGLE_ADS_API_VERSION no Easypanel (ex: v26, v27)
const GADS_VERSION_START = parseInt((process.env.GOOGLE_ADS_API_VERSION ?? "v21").replace("v", ""), 10)
// Cache da versão resolvida para evitar retries desnecessários no mesmo processo
let _resolvedVersion: number | null = null

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

// ─── Error extraction ─────────────────────────────────────────────────────────

function extractGadsError(status: number, data: any, label: string): string {
  const gadsErrors = data?.error?.details?.find((d: any) =>
    d["@type"]?.includes("GoogleAdsFailure")
  )?.errors ?? []

  const codes = gadsErrors.map((e: any) => {
    const codeEntry = Object.entries(e.errorCode ?? {})[0]
    return codeEntry ? `${codeEntry[0]}:${codeEntry[1]}` : null
  }).filter(Boolean)

  const deepMsg = gadsErrors[0]?.message
  const topMsg  = data?.error?.message ?? JSON.stringify(data).slice(0, 400)
  const msg     = deepMsg ? `${deepMsg} (${topMsg})` : topMsg
  const codeStr = codes.length ? ` [${codes.join(", ")}]` : ""

  console.error(`[google-ads] ${label} ${status}:`, JSON.stringify(data))
  return `${msg}${codeStr}`
}

// ─── Version-aware fetch helper ───────────────────────────────────────────────

async function gadsRequest(
  path: string,
  method: "GET" | "POST",
  extraHeaders: Record<string, string>,
  body?: string,
): Promise<any> {
  const start = _resolvedVersion ?? GADS_VERSION_START
  let version = start

  while (version <= 30) {
    const url = `https://googleads.googleapis.com/v${version}${path}`
    const res = await fetch(url, { method, headers: extraHeaders, body })
    let data: any
    try {
      data = await res.json()
    } catch {
      const text = await res.text().catch(() => "")
      console.error(`[google-ads] v${version} non-JSON ${res.status} (${path}):`, text.slice(0, 400))
      if (res.status === 404) { version++; continue }
      throw new Error(`Google Ads API ${res.status}: ${text.slice(0, 300)}`)
    }
    if (!res.ok) {
      const isUnsupported = (data?.error?.details ?? []).some((d: any) =>
        d.errors?.some((e: any) => e.errorCode?.requestError === "UNSUPPORTED_VERSION")
      )
      if (isUnsupported) {
        console.warn(`[google-ads] v${version} unsupported, trying v${version + 1}`)
        version++
        continue
      }
      throw new Error(extractGadsError(res.status, data, `v${version}${path}`))
    }
    if (version !== start) {
      console.log(`[google-ads] resolved version: v${version} (was v${start})`)
      _resolvedVersion = version
    }
    return data
  }
  throw new Error(`Nenhuma versão Google Ads API suportada (tentei v${start}–v30). Acesse developers.google.com/google-ads/api/docs/release-notes para ver a versão atual e configure GOOGLE_ADS_API_VERSION no Easypanel.`)
}

// ─── API request helper ───────────────────────────────────────────────────────

async function gadsPost(path: string, body: unknown, accessToken: string, managerCustomerId?: string) {
  const devToken = await getGoogleDeveloperToken()
  const headers: Record<string, string> = {
    "Content-Type":    "application/json",
    "Authorization":   `Bearer ${accessToken}`,
    "developer-token": devToken,
  }
  if (managerCustomerId) headers["login-customer-id"] = managerCustomerId
  return gadsRequest(path, "POST", headers, JSON.stringify(body))
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
  const data = await gadsRequest("/customers:listAccessibleCustomers", "GET", {
    Authorization:    `Bearer ${accessToken}`,
    "developer-token": devToken,
  })
  return (data.resourceNames ?? []).map((r: string) => ({ resourceName: r, id: r.replace("customers/", "") }))
}


export async function getCustomerInfo(customerId: string, accessToken: string, loginCustomerId?: string) {
  const devToken = await getGoogleDeveloperToken()
  const base = { Authorization: `Bearer ${accessToken}`, "developer-token": devToken }

  // Try progressively: no login-customer-id → self → provided manager
  const attempts: Record<string, string>[] = [
    { ...base },
    { ...base, "login-customer-id": customerId },
    ...(loginCustomerId && loginCustomerId !== customerId
      ? [{ ...base, "login-customer-id": loginCustomerId }]
      : []),
  ]

  for (const headers of attempts) {
    try {
      const data = await gadsRequest(`/customers/${customerId}`, "GET", headers)
      if (data?.id || data?.resourceName) return data
    } catch (e: any) {
      console.warn(`[google-ads] getCustomerInfo ${customerId} (login=${headers["login-customer-id"] ?? "none"}):`, e.message)
    }
  }
  return null
}

export async function createGoogleCampaign(tenantId: string, params: {
  name: string
  dailyBudget: number  // em reais
  channelType: "SEARCH" | "DISPLAY" | "PERFORMANCE_MAX"
}) {
  const { accessToken, conn } = await getTokens(tenantId)
  const customerId = conn.customer_id
  const mcc        = conn.manager_customer_id

  // 1. Criar orçamento diário
  const budgetRes = await gadsPost(
    `/customers/${customerId}/campaignBudgets:mutate`,
    { operations: [{ create: { name: `${params.name} Budget`, amountMicros: Math.round(params.dailyBudget * 1_000_000), deliveryMethod: "STANDARD" } }] },
    accessToken, mcc,
  )
  const budgetRn = budgetRes.results?.[0]?.resourceName
  if (!budgetRn) throw new Error("Falha ao criar orçamento da campanha")

  // 2. Criar campanha com lance automático
  const base: Record<string, any> = {
    name:                    params.name,
    status:                  "PAUSED",
    advertisingChannelType:  params.channelType,
    campaignBudget:          budgetRn,
  }

  if (params.channelType === "SEARCH") {
    base.maximizeClicks = {}
    base.networkSettings = { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false }
  } else if (params.channelType === "PERFORMANCE_MAX") {
    base.maximizeConversionValue = { targetRoas: 0 }
  } else {
    base.maximizeClicks = {}
  }

  const campaignRes = await gadsPost(
    `/customers/${customerId}/campaigns:mutate`,
    { operations: [{ create: base }] },
    accessToken, mcc,
  )
  return {
    resourceName: campaignRes.results?.[0]?.resourceName,
    customerId,
  }
}

// ─── Ad Groups ────────────────────────────────────────────────────────────────

export async function createAdGroup(tenantId: string, params: {
  campaignResourceName: string  // "customers/123/campaigns/456"
  name: string
  cpcBidMicros?: number
}) {
  const { accessToken, conn } = await getTokens(tenantId)
  const customerId = conn.customer_id

  const create: Record<string, any> = {
    name:     params.name,
    campaign: params.campaignResourceName,
    status:   "ENABLED",
    type:     "SEARCH_STANDARD",
  }
  if (params.cpcBidMicros) create.cpcBidMicros = params.cpcBidMicros

  const res = await gadsPost(
    `/customers/${customerId}/adGroups:mutate`,
    { operations: [{ create }] },
    accessToken, conn.manager_customer_id,
  )
  return { resourceName: res.results?.[0]?.resourceName, customerId }
}

export async function getAdGroups(tenantId: string, campaignId: string, datePreset = "last_7d") {
  const { accessToken, conn } = await getTokens(tenantId)
  const dateRange = DATE_RANGES[datePreset] ?? "LAST_7_DAYS"
  const query = `
    SELECT
      ad_group.id, ad_group.resource_name, ad_group.name, ad_group.status, ad_group.cpc_bid_micros,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions
    FROM ad_group
    WHERE campaign.id = ${campaignId}
      AND segments.date DURING ${dateRange}
      AND ad_group.status != 'REMOVED'
  `
  const data = await gadsPost(`/customers/${conn.customer_id}/googleAds:search`, { query }, accessToken, conn.manager_customer_id)
  return (data.results ?? []).map((r: any) => {
    const ag = r.adGroup
    const m  = r.metrics
    return {
      id:           ag.id,
      resourceName: ag.resourceName,
      name:         ag.name,
      status:       ag.status,
      cpc_bid:      ag.cpcBidMicros ? Number(ag.cpcBidMicros) / 1_000_000 : null,
      impressions:  Number(m?.impressions ?? 0),
      clicks:       Number(m?.clicks ?? 0),
      spend:        (m?.costMicros ?? 0) / 1_000_000,
      conversions:  Number(m?.conversions ?? 0),
    }
  })
}

export async function updateAdGroupStatus(tenantId: string, adGroupResourceName: string, status: "ENABLED" | "PAUSED") {
  const { accessToken, conn } = await getTokens(tenantId)
  return gadsPost(
    `/customers/${conn.customer_id}/adGroups:mutate`,
    { operations: [{ update: { resourceName: adGroupResourceName, status }, updateMask: "status" }] },
    accessToken, conn.manager_customer_id,
  )
}

// ─── Keywords ─────────────────────────────────────────────────────────────────

export type KeywordMatchType = "EXACT" | "PHRASE" | "BROAD"
const MATCH_TYPES = new Set<KeywordMatchType>(["EXACT", "PHRASE", "BROAD"])

function normalizeMatchType(mt: string | undefined, fallback: KeywordMatchType): KeywordMatchType {
  const upper = (mt ?? "").toUpperCase() as KeywordMatchType
  return MATCH_TYPES.has(upper) ? upper : fallback
}

export async function createKeywords(tenantId: string, params: {
  adGroupResourceName: string
  keywords: { text: string; matchType?: string }[]
}) {
  const { accessToken, conn } = await getTokens(tenantId)
  if (!params.keywords?.length) throw new Error("Informe ao menos uma palavra-chave.")

  const operations = params.keywords.map(kw => ({
    create: {
      adGroup: params.adGroupResourceName,
      status:  "ENABLED",
      keyword: { text: kw.text, matchType: normalizeMatchType(kw.matchType, "PHRASE") },
    },
  }))
  const res = await gadsPost(
    `/customers/${conn.customer_id}/adGroupCriteria:mutate`,
    { operations },
    accessToken, conn.manager_customer_id,
  )
  return { created: res.results?.length ?? 0, resourceNames: (res.results ?? []).map((r: any) => r.resourceName) }
}

export async function addNegativeKeywords(tenantId: string, params: {
  adGroupResourceName: string
  keywords: { text: string; matchType?: string }[]
}) {
  const { accessToken, conn } = await getTokens(tenantId)
  if (!params.keywords?.length) throw new Error("Informe ao menos uma palavra-chave negativa.")

  const operations = params.keywords.map(kw => ({
    create: {
      adGroup:  params.adGroupResourceName,
      negative: true,
      keyword:  { text: kw.text, matchType: normalizeMatchType(kw.matchType, "BROAD") },
    },
  }))
  const res = await gadsPost(
    `/customers/${conn.customer_id}/adGroupCriteria:mutate`,
    { operations },
    accessToken, conn.manager_customer_id,
  )
  return { created: res.results?.length ?? 0 }
}

export async function getKeywords(tenantId: string, adGroupId: string, datePreset = "last_7d") {
  const { accessToken, conn } = await getTokens(tenantId)
  const dateRange = DATE_RANGES[datePreset] ?? "LAST_7_DAYS"
  const query = `
    SELECT
      ad_group_criterion.criterion_id, ad_group_criterion.resource_name,
      ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
      ad_group_criterion.status, ad_group_criterion.quality_info.quality_score,
      metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.average_cpc
    FROM keyword_view
    WHERE ad_group.id = ${adGroupId}
      AND segments.date DURING ${dateRange}
      AND ad_group_criterion.status != 'REMOVED'
  `
  const data = await gadsPost(`/customers/${conn.customer_id}/googleAds:search`, { query }, accessToken, conn.manager_customer_id)
  return (data.results ?? []).map((r: any) => {
    const c = r.adGroupCriterion
    const m = r.metrics
    return {
      id:            c.criterionId,
      resourceName:  c.resourceName,
      text:          c.keyword?.text,
      matchType:     c.keyword?.matchType,
      status:        c.status,
      qualityScore:  c.qualityInfo?.qualityScore ?? null,
      impressions:   Number(m?.impressions ?? 0),
      clicks:        Number(m?.clicks ?? 0),
      spend:         (m?.costMicros ?? 0) / 1_000_000,
      conversions:   Number(m?.conversions ?? 0),
      avg_cpc:       (m?.averageCpc ?? 0) / 1_000_000,
    }
  })
}

// ─── Responsive Search Ads ──────────────────────────────────────────────────────

export async function createResponsiveSearchAd(tenantId: string, params: {
  adGroupResourceName: string
  headlines: string[]     // 3–15 headlines, max 30 chars each
  descriptions: string[]  // 2–4 descriptions, max 90 chars each
  finalUrl: string
  path1?: string
  path2?: string
}) {
  const { accessToken, conn } = await getTokens(tenantId)

  if (!params.headlines || params.headlines.length < 3)
    throw new Error("Responsive Search Ad exige no mínimo 3 headlines (máx. 30 caracteres cada).")
  if (!params.descriptions || params.descriptions.length < 2)
    throw new Error("Responsive Search Ad exige no mínimo 2 descriptions (máx. 90 caracteres cada).")
  const badHeadline = params.headlines.find(h => h.length > 30)
  if (badHeadline) throw new Error(`Headline "${badHeadline}" excede 30 caracteres (${badHeadline.length}).`)
  const badDesc = params.descriptions.find(d => d.length > 90)
  if (badDesc) throw new Error(`Description "${badDesc}" excede 90 caracteres (${badDesc.length}).`)
  if (!params.finalUrl) throw new Error("finalUrl é obrigatório para criar o anúncio.")

  const responsiveSearchAd: Record<string, any> = {
    headlines:    params.headlines.map(text => ({ text })),
    descriptions: params.descriptions.map(text => ({ text })),
  }
  if (params.path1) responsiveSearchAd.path1 = params.path1
  if (params.path2) responsiveSearchAd.path2 = params.path2

  const res = await gadsPost(
    `/customers/${conn.customer_id}/adGroupAds:mutate`,
    {
      operations: [{
        create: {
          adGroup: params.adGroupResourceName,
          status:  "PAUSED",
          ad:      { finalUrls: [params.finalUrl], responsiveSearchAd },
        },
      }],
    },
    accessToken, conn.manager_customer_id,
  )
  return { resourceName: res.results?.[0]?.resourceName }
}

export async function updateAdStatus(tenantId: string, adGroupAdResourceName: string, status: "ENABLED" | "PAUSED") {
  const { accessToken, conn } = await getTokens(tenantId)
  return gadsPost(
    `/customers/${conn.customer_id}/adGroupAds:mutate`,
    { operations: [{ update: { resourceName: adGroupAdResourceName, status }, updateMask: "status" }] },
    accessToken, conn.manager_customer_id,
  )
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
  const customerId = conn.customer_id
  const mcc        = conn.manager_customer_id
  const status     = enable ? "ENABLED" : "PAUSED"

  // 1. Atualiza a campanha
  await gadsPost(
    `/customers/${customerId}/campaigns:mutate`,
    { operations: [{ update: { resourceName: `customers/${customerId}/campaigns/${campaignId}`, status }, updateMask: "status" }] },
    accessToken, mcc,
  )

  // 2. Busca ad groups da campanha
  const agData = await gadsPost(
    `/customers/${customerId}/googleAds:search`,
    { query: `SELECT ad_group.id, ad_group.resource_name FROM ad_group WHERE campaign.id = ${campaignId} AND ad_group.status != 'REMOVED'` },
    accessToken, mcc,
  )
  const adGroups: { id: string; resourceName: string }[] = (agData.results ?? []).map((r: any) => ({
    id: r.adGroup.id,
    resourceName: r.adGroup.resourceName,
  }))

  if (!adGroups.length) return { ok: true, adGroups: 0 }

  // 3. Atualiza todos os ad groups
  await gadsPost(
    `/customers/${customerId}/adGroups:mutate`,
    { operations: adGroups.map(ag => ({ update: { resourceName: ag.resourceName, status }, updateMask: "status" })) },
    accessToken, mcc,
  )

  // 4. Busca e atualiza todos os anúncios da campanha
  const adsData = await gadsPost(
    `/customers/${customerId}/googleAds:search`,
    { query: `SELECT ad_group_ad.resource_name FROM ad_group_ad WHERE campaign.id = ${campaignId} AND ad_group_ad.status != 'REMOVED'` },
    accessToken, mcc,
  )
  const adResourceNames: string[] = (adsData.results ?? []).map((r: any) => r.adGroupAd.resourceName)

  if (adResourceNames.length) {
    await gadsPost(
      `/customers/${customerId}/adGroupAds:mutate`,
      { operations: adResourceNames.map(rn => ({ update: { resourceName: rn, status }, updateMask: "status" })) },
      accessToken, mcc,
    )
  }

  return { ok: true, adGroups: adGroups.length, ads: adResourceNames.length }
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
