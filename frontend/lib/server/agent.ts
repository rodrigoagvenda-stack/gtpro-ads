import Anthropic from "@anthropic-ai/sdk"
import { getAnthropicKey } from "./platform"
import { createServiceClient } from "./supabase"
import { sendText } from "./whatsapp"
import {
  getCampaigns, getInsights, getCampaignInsights, getAdSetInsights, getAdInsights, getInsightsByBreakdown,
  createCampaign, updateCampaign, duplicateCampaign, deleteCampaign, toggleCampaign,
  getAdSets, getAdSetById, createAdSet, updateAdSet, duplicateAdSet, deleteAdSet,
  getAds, getAdsByAdSet, updateAd, duplicateAd, deleteAd, createAd,
  getPixels, getPixelStats, getCustomConversions,
  getCustomAudiences, createLookalikeAudience, createWebsiteAudience, createEngagementAudience,
  getAccountInfo,
} from "./meta-ads"

const SYSTEM_PROMPT = `Você é o GTPRO, agente especializado em gestão de tráfego pago no Meta Ads.

Você tem acesso COMPLETO à API do Meta Ads: criar, editar, duplicar e deletar campanhas, conjuntos de anúncios e anúncios; acessar pixel, conversões, públicos e insights detalhados.

────────────────────────────────────────
REGRAS DE FORMATAÇÃO — OBRIGATÓRIAS
────────────────────────────────────────
- Nunca use tabelas markdown (sem pipes |)
- Nunca use emojis
- Use listas com hífen quando necessário
- Seja direto e conciso
- SEMPRE escreva em português brasileiro com acentuação completa e correta
- NUNCA omita acentos

────────────────────────────────────────
FLUXO DE CRIAÇÃO DE CAMPANHA
────────────────────────────────────────
Quando o usuário pedir para criar uma campanha, SEMPRE apresente os dois modos antes de prosseguir:

"Para criar sua campanha, prefere:

1. Modo Inteligente — analiso seus dados históricos e identifico a melhor oportunidade, criando uma campanha com base em evidências reais da sua conta.

2. Modo Manual — você me passa as informações e eu estruturo tudo com você passo a passo.

Qual prefere?"

MODO 1 — INTELIGENTE:
- Use get_campaigns e get_account_insights para analisar a conta
- Identifique a maior oportunidade (campanha com melhor CPL/ROAS que pode escalar, gargalo que pode ser corrigido, objetivo não explorado)
- Apresente a análise com números reais: "A campanha X trouxe CPL de R$X. Criando uma campanha similar com ajuste Y, estimo redução de Z% no CPL com base no histórico"
- NUNCA use achismo — só afirme o que os dados sustentam
- Pergunte: "Posso implementar essa estrutura?" e só execute após aprovação

MODO 2 — MANUAL (step by step):
Conduza o usuário pelos seguintes passos em ordem, um de cada vez:
1. Objetivo da campanha (LEADS, SALES, TRAFFIC, ENGAGEMENT, MESSAGES)
2. Público-alvo (idade, gênero, localização, interesses)
3. Budget diário ou total e período
4. Formato do criativo (imagem, vídeo, carrossel)
5. Copy do anúncio — neste passo, use sua skill de copywriter: crie 3 versões de headline e texto primary, seguindo boas práticas de tráfego pago para o objetivo escolhido
6. URL de destino e UTM (use generate_utm para gerar os parâmetros)
7. Nome da campanha (siga o template de nomenclatura configurado)
8. Revisão final — liste tudo e pergunte "Confirma a criação?"

────────────────────────────────────────
SKILL: COPYWRITER DE ANÚNCIOS
────────────────────────────────────────
Quando chegar na etapa de copy (modo manual) ou quando o usuário pedir copy:
- Crie 3 variações de headline (máx. 40 caracteres cada)
- Crie 3 variações de texto primary (máx. 125 caracteres para feed, máx. 90 para stories)
- Para LEADS: foque em dor/solução e CTA direto ("Fale agora", "Quero saber mais")
- Para SALES: foque em benefício + prova social + urgência
- Para MESSAGES/WHATSAPP: foque em conversa natural, convide para o WhatsApp
- Para TRAFFIC: foque em curiosidade e benefício claro
- Justifique cada escolha em uma linha

────────────────────────────────────────
SKILL: ESTRATEGISTA DE CAMPANHA
────────────────────────────────────────
Para cada objetivo, siga esta estrutura recomendada:

LEADS:
- Objetivo: OUTCOME_LEADS
- Otimização: LEAD_GENERATION
- Público: broad (25-55, interesses do nicho) + lookalike dos leads existentes
- Budget inicial sugerido: R$30-50/dia por conjunto
- Criativo: vídeo curto (15s) ou imagem com formulário nativo

VENDAS/E-COMMERCE:
- Objetivo: OUTCOME_SALES
- Otimização: OFFSITE_CONVERSIONS (Purchase)
- Pixel obrigatório — verificar se está ativo antes de criar
- Público: retargeting visitantes + lookalike compradores
- Budget: mínimo R$50/dia para sair da fase de aprendizado

WHATSAPP/MENSAGENS:
- Objetivo: OUTCOME_ENGAGEMENT ou MESSAGES
- Otimização: CONVERSATIONS
- SEMPRE verificar WhatsApp conectado antes de criar (use check_whatsapp_status)
- Se não tiver WhatsApp conectado, perguntar: "Deseja usar WhatsApp Business ou uma URL de destino?"
- Público: broad por localização + comportamentos de engajamento

TRÁFEGO:
- Objetivo: OUTCOME_TRAFFIC
- Otimização: LINK_CLICKS ou LANDING_PAGE_VIEWS
- Rastreamento UTM obrigatório

────────────────────────────────────────
NOMENCLATURA DE CAMPANHAS
────────────────────────────────────────
Se um template de nomenclatura estiver configurado, SEMPRE siga-o ao criar campanhas.
Substitua as variáveis pelos valores reais da campanha sendo criada.
Se não houver template, sugira um nome descritivo no formato: [Objetivo] - [Público] - [Data]

────────────────────────────────────────
REGRAS GERAIS DE COMPORTAMENTO
────────────────────────────────────────
- Para saudações ou perguntas simples, responda brevemente sem buscar dados
- Só use ferramentas quando o usuário pedir análise, métricas ou ações concretas
- Em modo supervisionado: na PRIMEIRA menção de uma ação de escrita, descreva o que vai fazer e pergunte "Posso executar?" — execute imediatamente se o usuário confirmar
- Em modo NÃO supervisionado: execute ações diretamente sem pedir confirmação
- NUNCA pergunte "em qual conta?" — use sempre a conta informada no contexto
- Nunca delete sem confirmação explícita
- Justifique cada ação com dados reais
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
  { name: "get_ads",          description: "Lista os anúncios de uma campanha com criativos.", input_schema: { ...o, properties: { campaign_id: s }, required: ["campaign_id"] } },
  { name: "get_ads_by_adset", description: "Lista os anúncios de um conjunto de anúncios.", input_schema: { ...o, properties: { adset_id: s }, required: ["adset_id"] } },
  { name: "get_ad_insights",  description: "Métricas detalhadas de um anúncio específico.", input_schema: { ...o, properties: { ad_id: s, date_preset: s }, required: ["ad_id"] } },

  // ── Ads — Write
  { name: "create_ad", description: "Cria um anúncio completo com criativo. UTM é injetado automaticamente via url_tags. Para anúncio de imagem forneça image_hash; para vídeo forneça video_id.", input_schema: { ...o, properties: { adset_id: s, name: s, page_id: s, headline: s, body: s, link_url: s, cta: s, image_hash: s, video_id: s, instagram_actor_id: s, caption: s, utm_tags: s, status: s }, required: ["adset_id", "name", "page_id", "link_url"] } },
  { name: "update_ad",    description: "Atualiza status ou nome de um anúncio.", input_schema: { ...o, properties: { ad_id: s, status: s, name: s }, required: ["ad_id"] } },
  { name: "duplicate_ad", description: "Duplica um anúncio, opcionalmente para outro ad set.", input_schema: { ...o, properties: { ad_id: s, adset_id: s }, required: ["ad_id"] } },
  { name: "delete_ad",    description: "Deleta um anúncio.", input_schema: { ...o, properties: { ad_id: s }, required: ["ad_id"] } },

  // ── Pixel
  { name: "get_pixels",             description: "Lista os Pixels do Facebook da conta.", input_schema: { ...o, properties: {} } },
  { name: "get_pixel_stats",        description: "Estatísticas de eventos de um Pixel.", input_schema: { ...o, properties: { pixel_id: s, date_preset: s }, required: ["pixel_id"] } },
  { name: "get_custom_conversions", description: "Lista as conversões customizadas configuradas na conta.", input_schema: { ...o, properties: {} } },

  // ── Audiences
  { name: "get_audiences",                description: "Lista públicos customizados da conta.", input_schema: { ...o, properties: {} } },
  { name: "create_lookalike_audience",    description: "Cria um público lookalike a partir de um público existente.", input_schema: { ...o, properties: { source_audience_id: s, name: s, country: s, ratio: n }, required: ["source_audience_id", "name", "country"] } },
  { name: "create_website_audience",      description: "Cria público de retargeting baseado em visitas ao pixel (website). Precisa do pixel_id.", input_schema: { ...o, properties: { name: s, pixel_id: s, retention_days: n, event: { type: "string", enum: ["PageView","ViewContent","Purchase","Lead","AddToCart"] } }, required: ["name", "pixel_id", "retention_days"] } },
  { name: "create_engagement_audience",   description: "Cria público de engajamento com a Página do Facebook.", input_schema: { ...o, properties: { name: s, page_id: s, retention_days: n, engagement_type: { type: "string", enum: ["PAGE_VISITED","PAGE_LIKED","PAGE_ENGAGED","PAGE_CTA_CLICKED"] } }, required: ["name", "page_id", "retention_days"] } },

  // ── UTM
  { name: "generate_utm", description: "Gera parâmetros UTM com tokens dinâmicos do Meta. Retorna a string para colar em Parâmetros de URL do criativo.", input_schema: { ...o, properties: { source: { type: "string", enum: ["facebook", "instagram", "meta"] }, medium: s, include_ad_name: b, include_placement: b, base_url: s }, required: [] } },

  // ── WhatsApp check
  { name: "check_whatsapp_status", description: "Verifica se o WhatsApp está configurado e conectado para esta conta. Use SEMPRE antes de criar campanha de Mensagens/WhatsApp.", input_schema: { ...o, properties: {} } },

  // ── Internal
  { name: "create_alert", description: "Registra um alerta interno no sistema.", input_schema: { ...o, properties: { type: { type: "string", enum: ["roas_baixo", "cpl_alto", "budget_esgotado", "campanha_rejeitada", "queda_performance"] }, message: s, campaign_id: s }, required: ["type", "message"] } },
]

const WRITE_TOOLS = new Set(["create_campaign","update_campaign","duplicate_campaign","delete_campaign","toggle_campaign","create_adset","update_adset","duplicate_adset","delete_adset","create_ad","update_ad","duplicate_ad","delete_ad","create_lookalike_audience","create_website_audience","create_engagement_audience"])

async function executeTool(name: string, input: Record<string, any>, tenantId: string) {
  const supabase = createServiceClient()

  if (name === "get_account_info")       return getAccountInfo(tenantId)
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
  if (name === "get_ads")            return getAds(tenantId, input.campaign_id)
  if (name === "get_ads_by_adset")   return getAdsByAdSet(tenantId, input.adset_id)
  if (name === "get_ad_insights")    return getAdInsights(tenantId, input.ad_id, input.date_preset)
  if (name === "update_ad") {
    const { ad_id, ...params } = input
    return updateAd(tenantId, ad_id, params)
  }
  if (name === "duplicate_ad")           return duplicateAd(tenantId, input.ad_id, input.adset_id)
  if (name === "delete_ad")              return deleteAd(tenantId, input.ad_id)
  if (name === "get_pixels")             return getPixels(tenantId)
  if (name === "get_pixel_stats")        return getPixelStats(tenantId, input.pixel_id, input.date_preset)
  if (name === "get_custom_conversions") return getCustomConversions(tenantId)
  if (name === "create_ad")               return createAd(tenantId, input)
  if (name === "get_audiences")           return getCustomAudiences(tenantId)
  if (name === "create_lookalike_audience")   return createLookalikeAudience(tenantId, input)
  if (name === "create_website_audience")     return createWebsiteAudience(tenantId, input as any)
  if (name === "create_engagement_audience")  return createEngagementAudience(tenantId, input as any)

  if (name === "check_whatsapp_status") {
    const { data } = await supabase
      .from("agent_configs")
      .select("whatsapp_number, provider, uazapi_instance, official_phone_id")
      .eq("tenant_id", tenantId)
      .single()
    const hasNumber   = !!(data?.whatsapp_number)
    const hasProvider = !!(data?.provider)
    const hasInstance = !!(data?.uazapi_instance || data?.official_phone_id)
    return {
      connected:      hasNumber && hasProvider && hasInstance,
      whatsapp_number: data?.whatsapp_number ?? null,
      provider:        data?.provider ?? null,
      configured:      hasProvider && hasInstance,
      message: hasNumber && hasProvider && hasInstance
        ? "WhatsApp configurado e conectado."
        : hasProvider
          ? "Provider configurado mas número de destino não cadastrado."
          : "WhatsApp não configurado. Vá em Configurações → WhatsApp.",
    }
  }

  if (name === "generate_utm") {
    const src   = input.source ?? "facebook"
    const med   = input.medium ?? "paid_social"
    const parts = [`utm_source=${src}`, `utm_medium=${med}`, `utm_campaign={{campaign.name}}`, `utm_content={{adset.name}}`]
    if (input.include_ad_name !== false) parts.push(`utm_term={{ad.name}}`)
    if (input.include_placement)         parts.push(`utm_placement={{placement}}`)
    parts.push(`fbclid={{fbclid}}`)
    const params = parts.join("&")
    const full   = input.base_url ? `${String(input.base_url).replace(/\?$/, "")}?${params}` : null
    return { params, full_url: full, instructions: "Cole o valor de `params` no campo Parâmetros de URL do criativo no gerenciador de anúncios." }
  }

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
  const model  = ALLOWED_MODELS.includes(modelId ?? "") ? modelId! : "claude-sonnet-4-6"

  const namingCtx = tenantConfig.campaign_naming_template
    ? `\nTemplate de nomenclatura de campanhas: "${tenantConfig.campaign_naming_template}" — SEMPRE siga este template ao nomear campanhas.`
    : ""

  const configCtx = `Configurações: objetivo=${tenantConfig.objetivo_principal}, ROAS mín=${tenantConfig.roas_minimo}, CPL máx=R$${tenantConfig.cpl_maximo}, budget mensal=R$${tenantConfig.budget_mensal ?? "não definido"}, modo supervisionado=${tenantConfig.modo_supervisionado ? "ATIVO" : "DESATIVADO"}. Conta de anúncios ativa: ${adAccountId ?? "padrão"} — use SOMENTE esta conta em todas as operações.${namingCtx}`

  const prior: Anthropic.MessageParam[] = (history ?? [])
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }))

  const userContent = prior.length === 0 ? `${configCtx}\n\n${message}` : message
  const messages: Anthropic.MessageParam[] = [...prior, { role: "user", content: userContent }]

  const actionsTaken: any[] = []
  const toolsUsed: { name: string; input: Record<string, any> }[] = []

  const supabase = createServiceClient()
  const period   = new Date().toISOString().slice(0, 7) // YYYY-MM

  async function trackUsage(usage: { input_tokens: number; output_tokens: number }) {
    supabase.rpc("increment_api_usage", {
      p_tenant_id:     tenantId,
      p_period:        period,
      p_input_tokens:  usage.input_tokens,
      p_output_tokens: usage.output_tokens,
    }).then(() => {})
  }

  while (true) {
    const response = await client.messages.create({ model, max_tokens: 4096, system: SYSTEM_PROMPT, tools: TOOLS, messages })
    messages.push({ role: "assistant", content: response.content })
    trackUsage(response.usage)

    if (response.stop_reason === "end_turn") {
      const text = response.content.find(b => b.type === "text")
      return { message: (text as any)?.text ?? "", actions_taken: actionsTaken, tools_used: toolsUsed }
    }

    if (response.stop_reason === "tool_use") {
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== "tool_use") continue
        toolsUsed.push({ name: block.name, input: block.input as any })
        try {
          const result = await executeTool(block.name, block.input as any, tenantId)
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
