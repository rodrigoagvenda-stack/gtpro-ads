import Anthropic from "@anthropic-ai/sdk"
import { getAnthropicKey } from "./platform"
import { createServiceClient } from "./supabase"
import { sendText } from "./whatsapp"
import {
  getCampaigns, getInsights, getCampaignInsights, getAdSetInsights, getAdInsights, getInsightsByBreakdown,
  createCampaign, updateCampaign, duplicateCampaign, deleteCampaign, toggleCampaign, updateBudget,
  getAdSets, getAdSetById, createAdSet, updateAdSet, duplicateAdSet, deleteAdSet,
  getAds, getAdsByAdSet, updateAd, duplicateAd, deleteAd,
  getPixels, getPixelStats, getCustomConversions,
  getCustomAudiences, createLookalikeAudience,
  getAccountInfo,
} from "./meta-ads"

const SYSTEM_PROMPT = `Você é o GTPRO, agente especializado em gestão de tráfego pago no Meta Ads.

Você tem acesso COMPLETO à API do Meta Ads: criar, editar, duplicar e deletar campanhas, conjuntos de anúncios e anúncios; acessar pixel, conversões, públicos e insights detalhados.

Regras de formatação — OBRIGATÓRIAS:
- Nunca use tabelas markdown (sem pipes |)
- Nunca use emojis
- Use listas com hífen quando necessário
- Seja direto e conciso
- SEMPRE escreva em português brasileiro com acentuação completa e correta
- NUNCA omita acentos: escreva "visão" não "visao", "ação" não "acao", "análise" não "analise", "não" não "nao", "é" não "e", "também" não "tambem", "informações" não "informacoes"
- O sistema suporta UTF-8 completo — use todos os caracteres especiais do português

Regras de comportamento:
- Para saudações ou perguntas simples, responda brevemente sem buscar dados
- Só use ferramentas quando o usuário pedir análise, métricas ou ações concretas
- Em modo supervisionado: na PRIMEIRA menção de uma ação de escrita (criar, editar, pausar, ativar, deletar, duplicar), descreva exatamente o que vai fazer e pergunte "Posso executar?" ou "Confirma?". Se o usuário confirmar com qualquer palavra de aprovação ("sim", "pode", "vai", "faz", "confirmo", "execute", "ok", "isso"), execute a ação IMEDIATAMENTE usando a ferramenta correta. Não pergunte duas vezes.
- Em modo NÃO supervisionado: execute ações diretamente sem pedir confirmação.
- NUNCA pergunte "em qual conta?" — use sempre a conta de anúncios informada no contexto
- Nunca delete sem confirmação explícita do usuário
- Justifique cada ação com dados
- Ao criar campanhas, sempre crie com status PAUSED por padrão`

const o = { type: "object" as const }
const s = { type: "string" as const }
const n = { type: "number" as const }
const b = { type: "boolean" as const }

const TOOLS: Anthropic.Tool[] = [
  // ── Account
  { name: "get_account_info",       description: "Informações da conta: moeda, fuso, saldo, limite de gasto.", input_schema: { ...o, properties: {} } },

  // ── Campaigns — Read
  { name: "get_campaigns",          description: "Lista todas as campanhas com métricas e orçamentos.", input_schema: { ...o, properties: { date_preset: s } } },
  { name: "get_campaign_insights",  description: "Métricas detalhadas de uma campanha específica.", input_schema: { ...o, properties: { campaign_id: s, date_preset: s }, required: ["campaign_id"] } },
  { name: "get_insights_breakdown", description: "Insights com breakdown por age, gender, placement, device, region etc.", input_schema: { ...o, properties: { breakdown: s, date_preset: s }, required: ["breakdown"] } },
  { name: "get_account_insights",   description: "Métricas agregadas da conta inteira.", input_schema: { ...o, properties: { date_preset: s } } },

  // ── Campaigns — Write
  { name: "create_campaign", description: "Cria uma nova campanha. Sempre cria como PAUSED por padrão.", input_schema: { ...o, properties: { name: s, objective: s, daily_budget: n, lifetime_budget: n, start_time: s, stop_time: s, special_ad_categories: { type: "array", items: s } }, required: ["name", "objective"] } },
  { name: "update_campaign", description: "Atualiza campos de uma campanha: nome, status, orçamento, datas.", input_schema: { ...o, properties: { campaign_id: s, name: s, status: s, daily_budget: n, lifetime_budget: n, start_time: s, stop_time: s }, required: ["campaign_id"] } },
  { name: "duplicate_campaign", description: "Duplica uma campanha (deep copy, cria como PAUSED).", input_schema: { ...o, properties: { campaign_id: s, new_name: s }, required: ["campaign_id"] } },
  { name: "delete_campaign",    description: "Deleta permanentemente uma campanha.", input_schema: { ...o, properties: { campaign_id: s }, required: ["campaign_id"] } },
  { name: "toggle_campaign",    description: "Ativa ou pausa uma campanha.", input_schema: { ...o, properties: { campaign_id: s, status: { type: "string", enum: ["ACTIVE", "PAUSED"] } }, required: ["campaign_id", "status"] } },

  // ── Ad Sets — Read
  { name: "get_adsets",         description: "Lista os conjuntos de anúncios de uma campanha.", input_schema: { ...o, properties: { campaign_id: s }, required: ["campaign_id"] } },
  { name: "get_adset",          description: "Detalhes de um conjunto de anúncios específico, incluindo targeting.", input_schema: { ...o, properties: { adset_id: s }, required: ["adset_id"] } },
  { name: "get_adset_insights", description: "Métricas detalhadas de um conjunto de anúncios.", input_schema: { ...o, properties: { adset_id: s, date_preset: s }, required: ["adset_id"] } },

  // ── Ad Sets — Write
  { name: "create_adset", description: "Cria um novo conjunto de anúncios.", input_schema: { ...o, properties: { campaign_id: s, name: s, optimization_goal: s, billing_event: s, daily_budget: n, lifetime_budget: n, targeting: { type: "object" as const }, start_time: s, end_time: s, bid_amount: n }, required: ["campaign_id", "name", "optimization_goal", "billing_event"] } },
  { name: "update_adset", description: "Atualiza campos de um conjunto de anúncios.", input_schema: { ...o, properties: { adset_id: s, name: s, status: s, daily_budget: n, lifetime_budget: n, targeting: { type: "object" as const }, bid_amount: n }, required: ["adset_id"] } },
  { name: "duplicate_adset", description: "Duplica um conjunto de anúncios.", input_schema: { ...o, properties: { adset_id: s, campaign_id: s }, required: ["adset_id"] } },
  { name: "delete_adset",    description: "Deleta um conjunto de anúncios.", input_schema: { ...o, properties: { adset_id: s }, required: ["adset_id"] } },

  // ── Ads — Read
  { name: "get_ads",         description: "Lista os anúncios de uma campanha com criativos.", input_schema: { ...o, properties: { campaign_id: s }, required: ["campaign_id"] } },
  { name: "get_ads_by_adset",description: "Lista os anúncios de um conjunto de anúncios.", input_schema: { ...o, properties: { adset_id: s }, required: ["adset_id"] } },
  { name: "get_ad_insights", description: "Métricas detalhadas de um anúncio específico.", input_schema: { ...o, properties: { ad_id: s, date_preset: s }, required: ["ad_id"] } },

  // ── Ads — Write
  { name: "update_ad",    description: "Atualiza status ou nome de um anúncio.", input_schema: { ...o, properties: { ad_id: s, status: s, name: s }, required: ["ad_id"] } },
  { name: "duplicate_ad", description: "Duplica um anúncio, opcionalmente para outro ad set.", input_schema: { ...o, properties: { ad_id: s, adset_id: s }, required: ["ad_id"] } },
  { name: "delete_ad",    description: "Deleta um anúncio.", input_schema: { ...o, properties: { ad_id: s }, required: ["ad_id"] } },

  // ── Pixel
  { name: "get_pixels",             description: "Lista os Pixels do Facebook da conta.", input_schema: { ...o, properties: {} } },
  { name: "get_pixel_stats",        description: "Estatísticas de eventos de um Pixel (visualizações, leads, compras).", input_schema: { ...o, properties: { pixel_id: s, date_preset: s }, required: ["pixel_id"] } },
  { name: "get_custom_conversions", description: "Lista as conversões customizadas configuradas na conta.", input_schema: { ...o, properties: {} } },

  // ── Audiences
  { name: "get_audiences",              description: "Lista públicos customizados da conta.", input_schema: { ...o, properties: {} } },
  { name: "create_lookalike_audience",  description: "Cria um público lookalike a partir de um público existente.", input_schema: { ...o, properties: { source_audience_id: s, name: s, country: s, ratio: n }, required: ["source_audience_id", "name", "country"] } },

  // ── UTM
  { name: "generate_utm", description: "Gera parâmetros UTM com tokens dinâmicos do Meta para rastrear leads por campanha, conjunto e criativo. Retorna a string para colar em Parâmetros de URL do criativo.", input_schema: { ...o, properties: { source: { type: "string", enum: ["facebook", "instagram", "meta"] }, medium: s, include_ad_name: b, include_placement: b, base_url: s }, required: [] } },

  // ── Internal
  { name: "create_alert", description: "Registra um alerta interno no sistema.", input_schema: { ...o, properties: { type: { type: "string", enum: ["roas_baixo", "cpl_alto", "budget_esgotado", "campanha_rejeitada", "queda_performance"] }, message: s, campaign_id: s }, required: ["type", "message"] } },
]

const WRITE_TOOLS = new Set(["create_campaign","update_campaign","duplicate_campaign","delete_campaign","toggle_campaign","create_adset","update_adset","duplicate_adset","delete_adset","update_ad","duplicate_ad","delete_ad","create_lookalike_audience"])

async function executeTool(name: string, input: Record<string, any>, tenantId: string, tenantConfig: Record<string, any>) {
  const supabase = createServiceClient()

  // ── Account
  if (name === "get_account_info")       return getAccountInfo(tenantId)

  // ── Campaigns
  if (name === "get_campaigns")          return getCampaigns(tenantId)
  if (name === "get_account_insights")   return getInsights(tenantId, input.date_preset)
  if (name === "get_campaign_insights")  return getCampaignInsights(tenantId, input.campaign_id, input.date_preset)
  if (name === "get_insights_breakdown") return getInsightsByBreakdown(tenantId, input.breakdown, input.date_preset)
  if (name === "create_campaign")        return createCampaign(tenantId, input)
  if (name === "update_campaign") {
    const { campaign_id, ...params } = input
    return updateCampaign(tenantId, campaign_id, params)
  }
  if (name === "duplicate_campaign")     return duplicateCampaign(tenantId, input.campaign_id, input.new_name)
  if (name === "delete_campaign")        return deleteCampaign(tenantId, input.campaign_id)
  if (name === "toggle_campaign")        return toggleCampaign(tenantId, input.campaign_id, input.status)

  // ── Ad Sets
  if (name === "get_adsets")         return getAdSets(tenantId, input.campaign_id)
  if (name === "get_adset")          return getAdSetById(tenantId, input.adset_id)
  if (name === "get_adset_insights") return getAdSetInsights(tenantId, input.adset_id, input.date_preset)
  if (name === "create_adset")       return createAdSet(tenantId, input)
  if (name === "update_adset") {
    const { adset_id, ...params } = input
    return updateAdSet(tenantId, adset_id, params)
  }
  if (name === "duplicate_adset")    return duplicateAdSet(tenantId, input.adset_id, input.campaign_id)
  if (name === "delete_adset")       return deleteAdSet(tenantId, input.adset_id)

  // ── Ads
  if (name === "get_ads")          return getAds(tenantId, input.campaign_id)
  if (name === "get_ads_by_adset") return getAdsByAdSet(tenantId, input.adset_id)
  if (name === "get_ad_insights")  return getAdInsights(tenantId, input.ad_id, input.date_preset)
  if (name === "update_ad") {
    const { ad_id, ...params } = input
    return updateAd(tenantId, ad_id, params)
  }
  if (name === "duplicate_ad")           return duplicateAd(tenantId, input.ad_id, input.adset_id)
  if (name === "delete_ad")              return deleteAd(tenantId, input.ad_id)

  // ── Pixel
  if (name === "get_pixels")             return getPixels(tenantId)
  if (name === "get_pixel_stats")        return getPixelStats(tenantId, input.pixel_id, input.date_preset)
  if (name === "get_custom_conversions") return getCustomConversions(tenantId)

  // ── Audiences
  if (name === "get_audiences")             return getCustomAudiences(tenantId)
  if (name === "create_lookalike_audience") return createLookalikeAudience(tenantId, input)

  // ── UTM
  if (name === "generate_utm") {
    const src = input.source ?? "facebook"
    const med = input.medium ?? "paid_social"
    const parts: string[] = [
      `utm_source=${src}`,
      `utm_medium=${med}`,
      `utm_campaign={{campaign.name}}`,
      `utm_content={{adset.name}}`,
    ]
    if (input.include_ad_name !== false) parts.push(`utm_term={{ad.name}}`)
    if (input.include_placement)         parts.push(`utm_placement={{placement}}`)
    parts.push(`fbclid={{fbclid}}`)
    const params = parts.join("&")
    const full   = input.base_url ? `${String(input.base_url).replace(/\?$/, "")}?${params}` : null
    return { params, full_url: full, instructions: "Cole o valor de `params` no campo Parâmetros de URL do criativo no gerenciador de anúncios (Rastreamento → Parâmetros de URL)." }
  }

  // ── Internal
  if (name === "create_alert") {
    const { data } = await supabase.from("alerts").insert({ tenant_id: tenantId, ...input, status: "active" }).select().single()
    const { data: ac } = await supabase.from("agent_configs").select("whatsapp_number").eq("tenant_id", tenantId).single()
    if (ac?.whatsapp_number) {
      const phone = (ac.whatsapp_number as string).replace(/\D/g, "")
      try { await sendText(phone, `🔔 *Alerta GTPRO*\n\n${input.message}`) } catch {}
    }
    return data
  }

  throw new Error(`Ferramenta desconhecida: ${name}`)
}

function logAction(tenantId: string, action: string, params: any, result: any, status: string) {
  const supabase = createServiceClient()
  supabase.from("agent_logs").insert({ tenant_id: tenantId, action, params, result, status, justification: "" })
}

export const ALLOWED_MODELS = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7"]

export async function runAgent(
  tenantId: string,
  message: string,
  tenantConfig: Record<string, any>,
  modelId?: string,
  history?: { role: string; content: string }[],
  adAccountId?: string
) {
  const apiKey = await getAnthropicKey()
  const client = new Anthropic({ apiKey })
  const model = ALLOWED_MODELS.includes(modelId ?? "") ? modelId! : "claude-sonnet-4-6"

  const configCtx = `Configurações: objetivo=${tenantConfig.objetivo_principal}, ROAS mín=${tenantConfig.roas_minimo}, CPL máx=R$${tenantConfig.cpl_maximo}, budget mensal=R$${tenantConfig.budget_mensal ?? "não definido"}, modo supervisionado=${tenantConfig.modo_supervisionado ? "ATIVO" : "DESATIVADO"}. Conta de anúncios ativa: ${adAccountId ?? "padrão"} — use SOMENTE esta conta em todas as operações.`

  const prior: Anthropic.MessageParam[] = (history ?? [])
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }))

  const userContent = prior.length === 0 ? `${configCtx}\n\n${message}` : message
  const messages: Anthropic.MessageParam[] = [...prior, { role: "user", content: userContent }]

  const actionsTaken: any[] = []
  const toolsUsed: { name: string; input: Record<string, any> }[] = []

  while (true) {
    const response = await client.messages.create({ model, max_tokens: 4096, system: SYSTEM_PROMPT, tools: TOOLS, messages })
    messages.push({ role: "assistant", content: response.content })

    if (response.stop_reason === "end_turn") {
      const text = response.content.find((b) => b.type === "text")
      return { message: (text as any)?.text ?? "", actions_taken: actionsTaken, tools_used: toolsUsed }
    }

    if (response.stop_reason === "tool_use") {
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== "tool_use") continue
        toolsUsed.push({ name: block.name, input: block.input as any })
        try {
          const result = await executeTool(block.name, block.input as any, tenantId, tenantConfig)
          logAction(tenantId, block.name, block.input, result, "success")
          if (WRITE_TOOLS.has(block.name)) actionsTaken.push({ tool: block.name, input: block.input, result })
          results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) })
        } catch (e: any) {
          logAction(tenantId, block.name, block.input, { error: e.message }, "failed")
          results.push({ type: "tool_result", tool_use_id: block.id, content: `Erro: ${e.message}`, is_error: true })
        }
      }
      messages.push({ role: "user", content: results })
    }
  }
}
