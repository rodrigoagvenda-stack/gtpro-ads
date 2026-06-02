import { createServiceClient } from "./supabase"
import { decrypt, encrypt } from "./crypto"
import { getMetaAppId, getMetaAppSecret } from "./platform"

const GRAPH = "https://graph.facebook.com/v25.0"

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

class MetaError extends Error {
  code: number
  subcode?: number
  constructor(message: string, code: number, subcode?: number) {
    super(message)
    this.code = code
    this.subcode = subcode
  }
}

function parseMetaError(raw: string): string {
  try {
    const json = JSON.parse(raw)
    const err = json?.error
    if (!err) return raw
    const code = err.code
    const sub  = err.error_subcode
    const msg  = err.message ?? ""
    if (code === 190 || err.type === "OAuthException") {
      if (sub === 463 || sub === 467) return "Token Meta expirado. Reconecte sua conta em Configurações → Meta Ads."
      if (sub === 458 || sub === 460) return "Token Meta revogado (senha ou permissão alterada). Reconecte sua conta em Configurações → Meta Ads."
      // Permissão ads_management ausente — Meta retorna 190 para escrita sem esse escopo
      if (msg.toLowerCase().includes("ads_management") || msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("scope"))
        return `Token sem permissão de escrita (ads_management). Reconecte a conta via OAuth em Configurações → Meta Ads para liberar criação e edição de campanhas. (código ${code}/${sub ?? "—"})`
      return `Token Meta inválido (código ${code}${sub ? `/${sub}` : ""}): ${msg || "reconecte sua conta em Configurações → Meta Ads."}`
    }
    if (code === 200 || code === 273 || code === 10)
      return `Permissão negada pela Meta (código ${code}): ${msg}. O token precisa ter permissão 'ads_management' — reconecte a conta via OAuth em Configurações → Meta Ads.`
    if (code === 100) return `Parâmetro inválido (código 100): ${msg}`
    if (code === 4 || code === 17 || code === 32 || code === 613 ||
        (code >= 80001 && code <= 80014))
      return "Limite de requisições da Meta atingido. Aguarde alguns minutos."
    return `${msg || raw} (código Meta ${code})`
  } catch {
    return raw
  }
}

async function graphGet(path: string, params: Record<string, string>) {
  const url = new URL(`${GRAPH}${path}`)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  console.log(`[meta-ads] GET ${path} params=${JSON.stringify(Object.fromEntries(Object.entries(params).filter(([k]) => k !== "access_token")))}`)
  const res = await fetch(url.toString())
  if (!res.ok) {
    const raw = await res.text()
    console.error(`[meta-ads] GET ${path} FAILED status=${res.status} response=${raw}`)
    throw new Error(parseMetaError(raw))
  }
  return res.json()
}

async function graphPost(path: string, token: string, body: Record<string, unknown>) {
  const url = new URL(`${GRAPH}${path}`)
  url.searchParams.set("access_token", token)
  console.log(`[meta-ads] POST ${path} body=${JSON.stringify(body)}`)
  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const raw = await res.text()
    console.error(`[meta-ads] POST ${path} FAILED status=${res.status} response=${raw}`)
    try {
      const json = JSON.parse(raw)
      throw new MetaError(parseMetaError(raw), json?.error?.code ?? 0, json?.error?.error_subcode)
    } catch (e) {
      if (e instanceof MetaError) throw e
      throw new Error(parseMetaError(raw))
    }
  }
  return res.json()
}

async function graphDelete(path: string, token: string) {
  const url = new URL(`${GRAPH}${path}`)
  url.searchParams.set("access_token", token)
  console.log(`[meta-ads] DELETE ${path}`)
  const res = await fetch(url.toString(), { method: "DELETE" })
  if (!res.ok) {
    const raw = await res.text()
    console.error(`[meta-ads] DELETE ${path} FAILED status=${res.status} response=${raw}`)
    throw new Error(parseMetaError(raw))
  }
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

export async function getCampaigns(tenantId: string, datePreset = "last_7d", connectionId?: string, since?: string, until?: string) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId, connectionId)
  const insightFields = "spend,impressions,clicks,reach,ctr,cpc,cpm,frequency,actions,action_values,purchase_roas"
  const insightParam = since && until
    ? `insights.time_range({"since":"${since}","until":"${until}"}){${insightFields}}`
    : `insights.date_preset(${datePreset}){${insightFields}}`
  const fields = `id,name,status,objective,daily_budget,lifetime_budget,start_time,stop_time,budget_remaining,buying_type,${insightParam}`

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

    // Seguidores / curtidas de página
    const follows    = pick("follow", "onsite_conversion.post_follow")
    const page_likes = pick("like", "page_like")

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
      daily_budget:    c.daily_budget    ? Number(c.daily_budget)    / 100 : undefined,
      lifetime_budget: c.lifetime_budget ? Number(c.lifetime_budget) / 100 : undefined,
      metrics: {
        spend,
        impressions: Number(ins.impressions ?? 0),
        clicks:      Number(ins.clicks ?? 0),
        reach:       Number(ins.reach ?? 0),
        ctr:         Number(ins.ctr ?? 0),
        cpc:         Number(ins.cpc ?? 0),
        cpm:         Number(ins.cpm ?? 0),
        frequency:   ins.frequency ? Number(ins.frequency) : undefined,
        leads,
        cpl,
        messaging_conversations: conversations,
        cpc_conv,
        post_engagement: engagements,
        page_likes,
        follows,
        roas: roas ?? roasFallback,
      },
    }
  })
}

// Normalize legacy objectives (pre-v17) to Meta API v22 OUTCOME_* format
const LEGACY_OBJECTIVE_MAP: Record<string, string> = {
  LEAD_GENERATION:  "OUTCOME_LEADS",
  LINK_CLICKS:      "OUTCOME_TRAFFIC",
  CONVERSIONS:      "OUTCOME_SALES",
  PAGE_LIKES:       "OUTCOME_ENGAGEMENT",
  POST_ENGAGEMENT:  "OUTCOME_ENGAGEMENT",
  REACH:            "OUTCOME_AWARENESS",
  BRAND_AWARENESS:  "OUTCOME_AWARENESS",
  VIDEO_VIEWS:      "OUTCOME_AWARENESS",
  APP_INSTALLS:     "OUTCOME_APP_PROMOTION",
  MESSAGES:         "OUTCOME_ENGAGEMENT",
}

export async function createCampaign(tenantId: string, params: Record<string, any>) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)

  // Meta API v22: special_ad_categories must be a non-empty array — ["NONE"] when no special category
  const cats: string[] = params.special_ad_categories?.length
    ? params.special_ad_categories
    : ["NONE"]

  // Normalize legacy objective names to v22 OUTCOME_* format
  const rawObjective = (params.objective ?? "").toUpperCase()
  const objective = LEGACY_OBJECTIVE_MAP[rawObjective] ?? rawObjective

  const hasCampaignBudget = !!(params.daily_budget || params.lifetime_budget)

  const body: Record<string, unknown> = {
    name:                  params.name,
    objective,
    status:                params.status ?? "PAUSED",
    special_ad_categories: cats,
  }

  // Meta API v22: required when campaign has NO budget (ABO — budget lives on ad sets)
  // true = ad sets can share 20% of budget across each other; false = each ad set has fixed budget
  if (!hasCampaignBudget) {
    body.is_adset_budget_sharing_enabled = params.is_adset_budget_sharing_enabled ?? false
  }

  if (params.daily_budget)    body.daily_budget    = Math.round(params.daily_budget * 100)
  if (params.lifetime_budget) body.lifetime_budget = Math.round(params.lifetime_budget * 100)
  if (params.start_time) body.start_time = params.start_time
  if (params.stop_time)  body.stop_time  = params.stop_time

  // bid_strategy: LOWEST_COST_WITH_BID_CAP e COST_CAP exigem bid_amount — sem ele a criação de conjuntos falha (erro 100/2490487).
  // Estratégias sem bid_amount obrigatório: LOWEST_COST_WITHOUT_CAP (padrão Meta quando omitido) e TARGET_COST.
  const BID_STRATEGIES_REQUIRING_AMOUNT = ["LOWEST_COST_WITH_BID_CAP", "COST_CAP"]
  if (params.bid_strategy) {
    const strat = (params.bid_strategy as string).toUpperCase()
    if (BID_STRATEGIES_REQUIRING_AMOUNT.includes(strat)) {
      if (!params.bid_amount || params.bid_amount <= 0) {
        throw new Error(
          `bid_strategy "${strat}" exige bid_amount (valor máximo de lance em R$). ` +
          "Informe bid_amount ou use lance automático omitindo bid_strategy."
        )
      }
      body.bid_strategy = strat
    } else {
      body.bid_strategy = strat
    }
  }
  // bid_amount no nível de campanha (CBO com bid cap)
  if (params.bid_amount && params.bid_amount > 0) body.bid_amount = Math.round(params.bid_amount * 100)

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

// Maps Meta campaign objectives (v22) → sensible optimization_goal default
const OBJECTIVE_TO_GOAL: Record<string, string> = {
  OUTCOME_LEADS:           "LEAD_GENERATION",
  OUTCOME_TRAFFIC:         "LINK_CLICKS",
  OUTCOME_SALES:           "OFFSITE_CONVERSIONS",
  OUTCOME_ENGAGEMENT:      "POST_ENGAGEMENT",
  OUTCOME_AWARENESS:       "REACH",
  OUTCOME_APP_PROMOTION:   "APP_INSTALLS",
  // Legacy objectives (pre-v17)
  LEAD_GENERATION:         "LEAD_GENERATION",
  LINK_CLICKS:             "LINK_CLICKS",
  CONVERSIONS:             "OFFSITE_CONVERSIONS",
  PAGE_LIKES:              "PAGE_LIKES",
  POST_ENGAGEMENT:         "POST_ENGAGEMENT",
  REACH:                   "REACH",
  BRAND_AWARENESS:         "REACH",
  VIDEO_VIEWS:             "VIDEO_VIEWS",
  APP_INSTALLS:            "APP_INSTALLS",
  MESSAGES:                "CONVERSATIONS",
}

// billing_event that's valid for each optimization_goal (Meta API v22)
const GOAL_TO_BILLING: Record<string, string> = {
  LINK_CLICKS:          "LINK_CLICKS",
  LANDING_PAGE_VIEWS:   "IMPRESSIONS",
  LEAD_GENERATION:      "IMPRESSIONS",
  QUALITY_LEAD:         "IMPRESSIONS",
  OFFSITE_CONVERSIONS:  "IMPRESSIONS",
  POST_ENGAGEMENT:      "IMPRESSIONS",
  PAGE_LIKES:           "IMPRESSIONS",
  REACH:                "IMPRESSIONS",
  IMPRESSIONS:          "IMPRESSIONS",
  VIDEO_VIEWS:          "IMPRESSIONS",
  THRUPLAY:             "THRUPLAY",
  APP_INSTALLS:         "IMPRESSIONS",
  CONVERSATIONS:        "IMPRESSIONS",
}

export async function createAdSet(tenantId: string, params: Record<string, any>) {
  const { token, adAccountId } = await getTokenAndAccount(tenantId)

  // Validate required fields upfront with clear messages
  if (!params.campaign_id) throw new Error("campaign_id é obrigatório para criar um conjunto de anúncios.")
  if (!params.name)        throw new Error("name é obrigatório para criar um conjunto de anúncios.")

  // Infer optimization_goal from campaign_objective if not explicitly provided
  const campaignObj = (params.campaign_objective ?? "").toUpperCase()
  const inferredGoal = OBJECTIVE_TO_GOAL[campaignObj] ?? null
  const optimizationGoal = (params.optimization_goal ?? inferredGoal ?? "LINK_CLICKS").toUpperCase()

  // billing_event must match optimization_goal — use the correct mapping
  const billingEvent = (params.billing_event ?? GOAL_TO_BILLING[optimizationGoal] ?? "IMPRESSIONS").toUpperCase()

  // targeting is required — validate before the API call to surface clear errors
  const targeting = params.targeting
  if (!targeting || typeof targeting !== "object" || Object.keys(targeting).length === 0) {
    throw new Error(
      "targeting é obrigatório para criar um conjunto de anúncios. " +
      "Inclua ao menos geo_locations (ex: { countries: ['BR'] }) ou custom_audiences."
    )
  }

  // Normalize distance_unit for city targeting — ensure it's always set
  if (targeting.geo_locations?.cities?.length) {
    targeting.geo_locations.cities = targeting.geo_locations.cities.map((city: any) => ({
      ...city,
      distance_unit: city.distance_unit ?? "kilometer",
    }))
  }

  // targeting_automation.advantage_audience obrigatório (erro 100/1870227 se omitido)
  // 0 = público manual (respeita interesses/geo definidos); 1 = Advantage+ audience (Meta expande automaticamente)
  if (!targeting.targeting_automation) {
    targeting.targeting_automation = {
      advantage_audience: params.advantage_audience ?? 0,
    }
  }

  const body: Record<string, unknown> = {
    campaign_id:       params.campaign_id,
    name:              params.name,
    optimization_goal: optimizationGoal,
    billing_event:     billingEvent,
    targeting,
    status:            params.status ?? "PAUSED",
  }

  // promoted_object — required for objectives that link to a page, pixel, or app
  if (params.promoted_object) {
    body.promoted_object = params.promoted_object
  } else {
    const needsPromo = [
      "LEAD_GENERATION", "QUALITY_LEAD",
      "CONVERSATIONS",
      "POST_ENGAGEMENT",
      "PAGE_LIKES",
      "OFFSITE_CONVERSIONS",
      "VIDEO_VIEWS",
    ].includes(optimizationGoal)

    if (needsPromo) {
      if (optimizationGoal === "OFFSITE_CONVERSIONS") {
        // pixel_id required for conversion campaigns
        if (!params.pixel_id) throw new Error(
          "pixel_id é obrigatório para campanhas de conversão (OFFSITE_CONVERSIONS). " +
          "Solicite ao usuário o ID do Pixel Meta conectado à conta."
        )
        const promoObj: Record<string, unknown> = { pixel_id: params.pixel_id }
        if (params.custom_event_type) promoObj.custom_event_type = params.custom_event_type
        if (params.page_id)           promoObj.page_id           = params.page_id
        body.promoted_object = promoObj
      } else {
        // page_id required for all other objectives
        if (!params.page_id) throw new Error(
          `page_id é obrigatório para o objetivo ${optimizationGoal}. ` +
          "Solicite ao usuário o ID da Página do Facebook."
        )
        const promoObj: Record<string, unknown> = { page_id: params.page_id }
        if (optimizationGoal === "LEAD_GENERATION" && params.pixel_id) {
          promoObj.pixel_id = params.pixel_id
        }
        body.promoted_object = promoObj
      }
    }
  }

  // destination_type — required for MESSAGES / WhatsApp campaigns
  if (params.destination_type) {
    body.destination_type = params.destination_type
  } else if (optimizationGoal === "CONVERSATIONS") {
    body.destination_type = params.destination_type ?? "MESSENGER"
  }

  if (params.daily_budget)    body.daily_budget    = Math.round(params.daily_budget * 100)
  if (params.lifetime_budget) body.lifetime_budget = Math.round(params.lifetime_budget * 100)
  if (params.start_time) body.start_time = params.start_time
  if (params.end_time)   body.end_time   = params.end_time

  // bid_strategy: contas podem ter padrão COST_CAP/LOWEST_COST_WITH_BID_CAP configurado — nesses casos
  // a Meta exige bid_amount mesmo sem bid_strategy no body (erro 100/2490487).
  // Solução: sempre declarar LOWEST_COST_WITHOUT_CAP quando nenhuma estratégia foi pedida,
  // sobrescrevendo o padrão da conta e eliminando a exigência de bid_amount.
  const BID_STRATEGIES_REQUIRING_AMOUNT = ["LOWEST_COST_WITH_BID_CAP", "COST_CAP", "MINIMUM_ROAS"]
  if (params.bid_strategy) {
    const strat = (params.bid_strategy as string).toUpperCase()
    if (BID_STRATEGIES_REQUIRING_AMOUNT.includes(strat) && (!params.bid_amount || params.bid_amount <= 0)) {
      throw new Error(
        `bid_strategy "${strat}" exige bid_amount (valor máximo de lance em R$). ` +
        "Informe bid_amount ou omita bid_strategy para lance automático."
      )
    }
    body.bid_strategy = strat
  } else {
    // Força lance automático puro — sobrescreve qualquer padrão da conta
    body.bid_strategy = "LOWEST_COST_WITHOUT_CAP"
  }
  // bid_amount: only set if explicitly provided by user
  if (params.bid_amount != null && params.bid_amount > 0) body.bid_amount = Math.round(params.bid_amount * 100)

  try {
    return await graphPost(`/act_${adAccountId}/adsets`, token, body)
  } catch (err) {
    // 1815857 = conta ignora LOWEST_COST_WITHOUT_CAP e exige bid_amount com cap
    // Retry com LOWEST_COST_WITH_BID_CAP e bid_amount = 10% do orçamento diário (mín R$1)
    if (err instanceof MetaError && err.subcode === 1815857) {
      const dailyBudgetCentavos = body.daily_budget as number | undefined
      const bidAmount = dailyBudgetCentavos
        ? Math.max(100, Math.round(dailyBudgetCentavos * 0.1))
        : 500
      console.log(`[meta-ads] retry adset com LOWEST_COST_WITH_BID_CAP bid_amount=${bidAmount}`)
      const retryBody = { ...body, bid_strategy: "LOWEST_COST_WITH_BID_CAP", bid_amount: bidAmount }
      return await graphPost(`/act_${adAccountId}/adsets`, token, retryBody)
    }
    throw err
  }
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

export async function getAds(tenantId: string, campaignId: string, datePreset = "last_7d", since?: string, until?: string) {
  const token = await getToken(tenantId)
  const adInsightFields = "impressions,reach,clicks,spend,ctr,cpc,cpm,actions,action_values,purchase_roas,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions,frequency"
  const insightParam = since && until
    ? `insights.time_range({"since":"${since}","until":"${until}"}){${adInsightFields}}`
    : `insights.date_preset(${datePreset}){${adInsightFields}}`
  const fields = `id,name,status,creative{id,name,thumbnail_url,body,title,image_url,object_story_spec},${insightParam}`
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

  if (!params.adset_id) throw new Error("adset_id é obrigatório para criar um anúncio.")
  if (!params.name)     throw new Error("name é obrigatório para criar um anúncio.")

  const creative: Record<string, any> = {}
  const isLeadGen = (params.optimization_goal ?? "").toUpperCase() === "LEAD_GENERATION"

  if (params.creative_id) {
    // Reuse existing creative — just reference it
    creative.creative_id = params.creative_id
  } else if (isLeadGen && params.lead_gen_form_id) {
    // Lead generation: creative uses lead_gen_form_id, not a destination URL
    if (!params.page_id) throw new Error("page_id é obrigatório para anúncios de geração de leads. Solicite ao usuário o ID da Página do Facebook.")
    const spec: Record<string, any> = { page_id: params.page_id }
    if (params.instagram_actor_id) spec.instagram_actor_id = params.instagram_actor_id
    const linkData: Record<string, any> = {
      message:          params.body ?? params.message ?? "",
      name:             params.headline ?? "",
      call_to_action:   { type: "SIGN_UP", value: { lead_gen_form_id: params.lead_gen_form_id } },
    }
    if (params.image_hash)  linkData.image_hash  = params.image_hash
    if (params.description) linkData.description = params.description
    spec.link_data = linkData
    creative.name              = params.creative_name ?? params.name
    creative.object_story_spec = spec
  } else {
    if (!params.page_id) throw new Error("page_id é obrigatório para criar um anúncio. Solicite ao usuário o ID da Página do Facebook.")

    const spec: Record<string, any> = { page_id: params.page_id }
    if (params.instagram_actor_id) spec.instagram_actor_id = params.instagram_actor_id

    const isWhatsAppAd =
      (params.destination_type ?? "").toUpperCase() === "WHATSAPP" ||
      params.cta === "WHATSAPP_MESSAGE" ||
      params.cta === "SEND_MESSAGE"

    if (params.video_id) {
      // Video creative — thumbnail obrigatório (erro 1443226 sem ele)
      // Usa image_url/image_hash se fornecido; senão busca automaticamente nos thumbnails do vídeo
      let thumbnailUrl: string | undefined = params.image_url ?? params.thumbnail_url
      if (!thumbnailUrl && !params.image_hash) {
        const thumbData = await graphGet(`/${params.video_id}/thumbnails`, {
          access_token: token,
          fields: "id,uri,is_preferred",
        })
        const preferred = (thumbData.data ?? []).find((t: any) => t.is_preferred) ?? thumbData.data?.[0]
        if (preferred?.uri) thumbnailUrl = preferred.uri
      }
      const destUrl = params.link_url ?? params.website_url
      const ctaValue: Record<string, any> = isWhatsAppAd
        ? { app_destination: "WHATSAPP" }
        : destUrl ? { link: destUrl } : {}
      const videoData: Record<string, any> = {
        video_id:       params.video_id,
        title:          params.headline ?? "",
        message:        params.body ?? params.message ?? "",
        call_to_action: { type: isWhatsAppAd ? "SEND_MESSAGE" : (params.cta ?? "LEARN_MORE"), value: ctaValue },
      }
      if (params.image_hash) videoData.image_hash = params.image_hash
      else if (thumbnailUrl) videoData.image_url  = thumbnailUrl
      spec.video_data = videoData
    } else {
      // Image creative — WhatsApp destination or regular link
      const destUrl = params.link_url ?? params.website_url

      if (!destUrl && !isWhatsAppAd) throw new Error(
        "link_url ou website_url é obrigatório para criar um anúncio de imagem/link. " +
        "Solicite ao usuário a URL de destino da campanha."
      )

      const linkData: Record<string, any> = {
        message:        params.body ?? params.message ?? "",
        name:           params.headline ?? "",
        call_to_action: isWhatsAppAd
          ? { type: "SEND_MESSAGE", value: { app_destination: "WHATSAPP" } }
          : { type: params.cta ?? "LEARN_MORE" },
      }
      if (!isWhatsAppAd && destUrl) linkData.link = destUrl
      if (params.image_hash)  linkData.image_hash  = params.image_hash
      if (params.caption)     linkData.caption     = params.caption
      if (params.description) linkData.description = params.description
      spec.link_data = linkData
    }

    creative.name              = params.creative_name ?? params.name
    creative.object_story_spec = spec
  }

  const body: Record<string, any> = {
    name:     params.name,
    adset_id: params.adset_id,
    creative,
    status:   params.status ?? "PAUSED",
  }
  if (params.tracking_specs) body.tracking_specs = params.tracking_specs

  // url_tags injects UTM params — skip for lead gen / WhatsApp (no destination URL) and when caller opts out
  const skipUtm = isLeadGen || isWhatsAppAd || params.skip_utm || params.url_tags === false
  if (!skipUtm) {
    body.url_tags = typeof params.url_tags === "string" ? params.url_tags : DEFAULT_UTM_TAGS
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

// ─── Interests ───────────────────────────────────────────────────────────────

export async function searchInterests(tenantId: string, query: string) {
  const token = await getToken(tenantId)
  const data = await graphGet("/search", {
    access_token: token,
    type: "adinterest",
    q: query,
    limit: "10",
  })
  return (data.data ?? []).map((r: any) => ({
    id:               r.id,
    name:             r.name,
    audience_size:    r.audience_size_lower_bound ?? null,
    topic:            r.topic ?? null,
    description:      r.description ?? null,
    disambiguation_category: r.disambiguation_category ?? null,
  }))
}

// ─── Pages ───────────────────────────────────────────────────────────────────

export async function getPages(tenantId: string) {
  const token = await getToken(tenantId)
  const data = await graphGet("/me/accounts", {
    access_token: token,
    fields: "id,name,category,fan_count,picture{url}",
    limit: "50",
  })
  return (data.data ?? []).map((p: any) => ({
    id:        p.id,
    name:      p.name,
    category:  p.category ?? null,
    fan_count: p.fan_count ?? null,
    picture:   p.picture?.data?.url ?? null,
  }))
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
  const PRESET_DAYS: Record<string, number> = {
    today: 1, yesterday: 1, last_3d: 3, last_7d: 7,
    last_14d: 14, last_28d: 28, last_30d: 30, last_90d: 90,
  }
  const days = PRESET_DAYS[datePreset] ?? 7
  const startTime = now - days * 24 * 3600
  const data = await graphGet(`/${pixelId}/stats`, {
    access_token: token,
    start_time: String(startTime),
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

// ─── Geo Location Search ─────────────────────────────────────────────────────

export async function searchGeoLocation(tenantId: string, query: string, locationType: "city" | "region" | "country" | "zip" = "city") {
  const token = await getToken(tenantId)
  const data = await graphGet("/search", {
    access_token: token,
    type: "adgeolocation",
    q: query,
    location_types: JSON.stringify([locationType]),
    country_code: "BR",
  })
  return (data.data ?? []).slice(0, 8).map((r: any) => ({
    key:          r.key,
    name:         r.name,
    type:         r.type,
    country_code: r.country_code,
    region:       r.region ?? null,
    region_id:    r.region_id ?? null,
  }))
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
