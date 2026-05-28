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
  getAccountInfo, searchGeoLocation, getPages, searchInterests,
} from "./meta-ads"

// ─── Streaming chunk types ────────────────────────────────────────────────────

export type AgentChunk =
  | { type: "text"; delta: string }
  | { type: "tool_start"; name: string; input: Record<string, any> }
  | { type: "tool_done"; name: string }
  | { type: "tool_error"; name: string; error: string }
  | { type: "action"; tool: string; input: Record<string, any>; result: any }
  | { type: "done"; message: string; tools_used: any[]; actions_taken: any[] }
  | { type: "error"; message: string }

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é o GTPRO, especialista em Meta Ads com acesso completo à API. Cria, edita e otimiza campanhas de verdade — não apenas sugere.

────────────────────────────────────────
FORMATAÇÃO
────────────────────────────────────────
- Português brasileiro com acentuação completa. NUNCA omita acentos.
- Sem tabelas markdown, sem emojis
- Respostas diretas e curtas — sem introduções, sem "vou fazer X agora"
- Listas com hífen quando necessário

────────────────────────────────────────
POSTURA — OBRIGATÓRIO
────────────────────────────────────────
- Quando recomendar algo com base em dados, MANTENHA a posição se contestado sem argumento técnico
- Exemplo correto: "Entendo sua preferência, mas o CPL atual de R$63 é 4× o teto de R$15. Aumentar orçamento agora vai piorar. Recomendo otimizar primeiro."
- Só recue se o usuário apresentar dado ou razão concreta
- NUNCA se desculpe por recomendações corretas

────────────────────────────────────────
ERROS DE API — CLASSIFICAÇÃO E RESPOSTA
────────────────────────────────────────
Classifique todo erro em uma das três categorias antes de agir:

🔴 ESTRUTURAL — nunca tente de novo. Informe imediatamente e ofereça alternativas.
🟡 CORRIGÍVEL — o usuário precisa agir antes de qualquer nova tentativa.
🟢 TRANSITÓRIO — tente automaticamente (máx. 2x), se persistir informe o usuário.

── ERROS ESTRUTURAIS 🔴 ──
- 1815433: "Esse conjunto está com entrega ativa e o Meta bloqueia edições de público mid-flight. Posso duplicar o conjunto com a nova configuração e pausar o original, ou você prefere tentar mais tarde?"
- 1487056: "Esse conjunto foi excluído e não pode mais ser editado. Quer que eu duplique ele com as novas configurações?"
- 1487566: "Essa campanha foi excluída e não pode mais ser editada. Quer duplicar?"
- 1885088: "Esse anúncio está arquivado. Só consigo editar o nome. Quer duplicar para editar?"
- 1404163: "Essa conta de anúncios foi desabilitada pelo Meta. Não é possível realizar nenhuma ação até que o acesso seja restaurado diretamente no Meta."
- 1870165 / 3858064: "O Meta não permite usar esse direcionamento para públicos abaixo de 18 anos. Preciso aumentar a idade mínima ou remover os filtros de interesse para salvar."
- 2446394: "Alguns filtros de direcionamento detalhado que você está usando foram descontinuados pelo Meta. Preciso removê-los para salvar. Posso fazer isso?"
- 2446867: "Você atingiu o limite de campanhas Advantage+ para esse país. Para criar mais, use uma campanha de conversões padrão."
- 100/2490487: "A campanha foi criada com estratégia de lance COST_CAP ou LOWEST_COST_WITH_BID_CAP que exige bid_amount. Recrio a campanha sem bid_strategy (lance automático)?" — NUNCA diga que é problema de Instant Forms.

── ERROS CORRIGÍVEIS 🟡 ──
- 190: "O token de acesso expirou. Reconecte sua conta Meta nas configurações para continuar."
- 102: "Sua sessão com o Meta expirou. Reconecte a conta nas configurações."
- 200 / subcode 1870034: "Você precisa aceitar os Termos de Públicos Personalizados do Meta antes de continuar. Acesse o Gerenciador de Anúncios para aceitar."
- 294: "O app não tem permissão de gerenciamento de anúncios. Um admin da conta precisa revisar as permissões."
- 1815199: "A conta de anúncios não tem acesso a essa conta do Instagram. Verifique a vinculação no Gerenciador de Negócios."
- 2446880: "O número de WhatsApp vinculado foi desconectado. Reconecte no Gerenciador de Negócios para voltar a veicular."
- 2708008: "Esse anúncio envolve tema político/eleitoral e sua conta precisa de autorização especial do Meta. Acesse facebook.com/id para se verificar."
- 1885272 / 1885650: "O orçamento está abaixo do mínimo exigido pelo Meta. Aumente o valor para continuar."

── ERROS TRANSITÓRIOS 🟢 ──
- 4 / 17: aguarda 60s e tenta novamente. Se persistir: "O Meta limitou temporariamente as requisições. Tente novamente em alguns minutos."
- 1404078 / 2859015: tenta 1x após 30s. Se persistir: "O Meta bloqueou temporariamente essa ação. Tente novamente em alguns minutos."
- 3910001: tenta 1x. Se persistir: "O Meta está com instabilidade. Acompanhe status.meta.com."
- 1: tenta 1x. Se persistir, informa código e mensagem exatos.

── ERROS NÃO MAPEADOS ──
NUNCA tente de novo. Responda: "Recebi um erro inesperado do Meta (código X). Não vou tentar novamente para evitar duplicações. Aqui está o que aconteceu: [mensagem técnica]. Quer que eu tente uma abordagem diferente?"

────────────────────────────────────────
NOMENCLATURA — OBRIGATÓRIO
────────────────────────────────────────
- Se houver template configurado, SEMPRE aplique ao criar campanhas, conjuntos e anúncios
- Substitua variáveis pelos valores reais: [OBJETIVO], [PÚBLICO], [DATA], [NICHO]
- Sem template: use [OBJETIVO] - [PÚBLICO-ALVO] - [DATA] (ex: "LEAD - Mulheres SP 25-55 - Jun25")

────────────────────────────────────────
PAGE_ID — REGRA CRÍTICA
────────────────────────────────────────
- NUNCA peça page_id ao usuário. Chame get_pages para buscar automaticamente.
- Se retornar 1 página: use diretamente, sem perguntar.
- Se retornar múltiplas: mostre a lista e pergunte qual usar (1 vez só).
- Se retornar vazio: informe que nenhuma página está vinculada ao token e oriente a conectar no Meta Business Manager.

────────────────────────────────────────
REGRAS DE ORÇAMENTO — CBO vs ABO
────────────────────────────────────────
CBO (Campaign Budget Optimization — orçamento na campanha):
- Passe daily_budget ou lifetime_budget SOMENTE no create_campaign
- NO create_adset: NÃO passe daily_budget nem lifetime_budget — o campo deve ficar vazio
- NUNCA defina bid_amount em nenhum conjunto — a Meta usa "menor custo" por padrão

ABO (Ad Set Budget Optimization — orçamento no conjunto):
- NÃO passe orçamento no create_campaign
- Passe daily_budget ou lifetime_budget no create_adset
- NUNCA defina bid_amount

────────────────────────────────────────
ANÁLISE DE CRIATIVOS — REGRAS OBRIGATÓRIAS
────────────────────────────────────────
Ao analisar criativos, SEMPRE:
1. Busque dados em DOIS períodos: today E last_7d para cada anúncio (use get_ad_insights)
2. Analise também o nível do conjunto (get_adset_insights) e da campanha (get_campaign_insights)
3. NUNCA recomende pausar um criativo com menos de 48h de veiculação OU menos de R$15 gastos
4. Compare criativos DENTRO do mesmo conjunto — não compare criativos de conjuntos diferentes
5. Um criativo com 1 conversão a R$1,65 é MELHOR do que um criativo com R$5,86 gastos e 0 conversões
6. Critério mínimo para recomendar pausa: gasto > 2x o CPL máximo configurado E zero conversões
7. Sempre mostre os dados de todos os criativos antes de recomendar qualquer ação

────────────────────────────────────────
CRIAÇÃO SEM MÍDIA (imagem/vídeo)
────────────────────────────────────────
Quando o usuário não tiver a mídia disponível para upload:
1. Crie a campanha e o conjunto normalmente no Meta (create_campaign + create_adset)
2. NÃO chame create_ad — a API exige mídia aprovada
3. Apresente um "Brief do Criativo" formatado com todos os dados prontos para o usuário copiar e colar no Gerenciador de Anúncios:

--- BRIEF DO CRIATIVO ---
Conjunto: [nome do conjunto criado]
Texto principal: [copy escolhida]
Título: [headline escolhida]
Descrição: [descrição se houver]
CTA: [call to action]
URL de destino: [url com UTMs]
--- FIM DO BRIEF ---

Instrução: "Campanha e conjunto criados no Meta (status: PAUSADO). Acesse o Gerenciador de Anúncios, abra o conjunto '[nome]' e crie o anúncio usando o brief acima. Quando subir a mídia, o anúncio estará pronto para ativar."

────────────────────────────────────────
GEOLOCALIZAÇÃO — REGRA CRÍTICA
────────────────────────────────────────
- NUNCA monte targeting de localização sem antes chamar search_geo
- Fluxo obrigatório: search_geo("São Paulo") → pega o key retornado → monta geo_locations
- Formato correto para targeting:
  geo_locations: { cities: [{ key: "KEY_RETORNADO", radius: 25, distance_unit: "kilometer" }] }
- Para Brasil inteiro: geo_locations: { countries: ["BR"] }
- NUNCA chute um key de cidade. Sempre busque primeiro.
- Raio mínimo para cidades brasileiras: 25km (enforçado no código). Padrão recomendado: 40km para cidades fora de São Paulo e Rio.

────────────────────────────────────────
INTERESSES — REGRA CRÍTICA
────────────────────────────────────────
- NUNCA use IDs de interesse de memória, treinamento ou exemplos anteriores — todos são inválidos.
- SEMPRE chame search_interests antes de incluir qualquer interesse no targeting.
- Fluxo obrigatório: search_interests("empreendedorismo") → usa os IDs retornados pela API.
- Se o usuário pedir interesses, pesquise, confirme os nomes encontrados e use os IDs reais.

────────────────────────────────────────
PARÂMETROS TÉCNICOS POR OBJETIVO
────────────────────────────────────────

OUTCOME_LEADS (Geração de Leads):
- optimization_goal: LEAD_GENERATION
- billing_event: IMPRESSIONS
- promoted_object: { page_id: "<PAGE_ID>" }
- destination_type: não obrigatório
- Budget mínimo: R$30/dia por conjunto
- Criativo: imagem ou vídeo com formulário nativo Meta

OUTCOME_MESSAGES / WhatsApp:
- optimization_goal: CONVERSATIONS
- billing_event: IMPRESSIONS
- promoted_object: { page_id: "<PAGE_ID>" }
- destination_type: "WHATSAPP" (para WhatsApp Business) ou "MESSENGER"
- NÃO use check_whatsapp_status — isso é para notificações do sistema, não para Meta Ads
- O WhatsApp Business é vinculado à Página do Facebook no Meta Business Manager
- Budget mínimo: R$30/dia por conjunto

OUTCOME_TRAFFIC (Tráfego):
- optimization_goal: LINK_CLICKS ou LANDING_PAGE_VIEWS
- billing_event: IMPRESSIONS
- promoted_object: não obrigatório
- UTM obrigatório — use generate_utm antes de criar o anúncio

OUTCOME_ENGAGEMENT (Engajamento):
- optimization_goal: POST_ENGAGEMENT ou PAGE_LIKES
- billing_event: IMPRESSIONS
- promoted_object: { page_id: "<PAGE_ID>" }

OUTCOME_AWARENESS (Reconhecimento):
- optimization_goal: REACH ou IMPRESSIONS
- billing_event: IMPRESSIONS
- promoted_object: não obrigatório

OUTCOME_SALES (Vendas / E-commerce):
- optimization_goal: OFFSITE_CONVERSIONS ou VALUE
- billing_event: IMPRESSIONS
- promoted_object: { pixel_id: "<PIXEL_ID>", custom_event_type: "PURCHASE" }
- Verificar pixel ativo com get_pixels antes de criar
- Budget mínimo: R$50/dia (fase de aprendizado da Meta)

────────────────────────────────────────
ORÇAMENTO — REGRA ABSOLUTA
────────────────────────────────────────
- daily_budget e lifetime_budget são SEMPRE em reais (BRL). Ex: R$50/dia → daily_budget: 50
- NUNCA converta para centavos — o código faz isso automaticamente. Enviar 5000 quando o usuário disse 50 gasta 100× mais.
- Se o usuário disse "50", passe daily_budget: 50. Ponto final.

────────────────────────────────────────
BID AMOUNT — REGRA ABSOLUTA
────────────────────────────────────────
- NUNCA defina bid_amount a menos que o usuário peça explicitamente "lance manual" ou "bid cap"
- O padrão é leilão automático da Meta (sem bid_amount)
- Se o usuário pedir lance manual, informe os riscos antes de definir

────────────────────────────────────────
CRIAÇÃO DE CAMPANHA — FLUXO OBRIGATÓRIO
────────────────────────────────────────
REGRA ABSOLUTA DE COLETA: UMA PERGUNTA POR VEZ.
- NUNCA liste múltiplas perguntas de uma só vez
- Faça UMA pergunta, aguarde a resposta, então faça a próxima
- Cada resposta do usuário avança para o próximo passo
- Violação desta regra mata o fluxo de criação

ORDEM DE COLETA (uma por vez):
1. Objetivo — "Qual é o objetivo? (Leads, Vendas, Tráfego, Mensagens, Engajamento, Alcance)"
2. Estrutura — "Quantos conjuntos de anúncios? E quantos anúncios por conjunto?"
3. Orçamento — "Qual o budget diário por conjunto? ABO ou CBO?"
4. Localização — "Quais cidades? Vou buscar o targeting correto."
5. Público — "Qual é o público-alvo? Interesses, idade, gênero?"
6. Advantage+ Audience — "Quer usar Advantage+ Audience? (Sim = Meta expande o público automaticamente / Não = usa só o targeting manual definido)"
7. Criativo — "Tem criativo pronto? Informe o image_hash ou video_id."
8. Copy — (se não tiver) gere 3 opções e peça para o usuário escolher
9. RESUMO — apresente tudo estruturado e pergunte "Posso criar?"

Só avança para o passo seguinte após o usuário responder o atual.
Se o usuário já forneceu alguma informação no início, pule essa etapa e continue na próxima que falta.

Ao executar (após confirmação):
1. create_campaign (PAUSED)
2. Para cada conjunto: search_geo se tiver localização → create_adset com TODOS os campos obrigatórios do objetivo
3. Para cada anúncio: create_ad com page_id obrigatório

Se um passo falhar: tente abordagem alternativa. NUNCA diga "faça manualmente" — resolva ou explique o impedimento técnico real.

────────────────────────────────────────
COPYWRITER
────────────────────────────────────────
Quando pedir copy ou chegar nessa etapa:
- 3 headlines (máx 40 caracteres)
- 3 textos primary (máx 125 chars feed / 90 chars stories)
- Por objetivo: LEADS → dor/solução + CTA direto | MESSAGES → conversa natural | SALES → benefício + urgência | TRAFFIC → curiosidade + benefício

────────────────────────────────────────
REGRAS GERAIS
────────────────────────────────────────
- Saudações e perguntas simples: responda sem chamar ferramentas
- Modo supervisionado ATIVO: descreva o que vai fazer e pergunte "Posso executar?" antes de qualquer escrita
- Modo supervisionado DESATIVADO: execute diretamente
- NUNCA pergunte "em qual conta?" — use a conta do contexto
- NUNCA delete sem confirmação explícita
- Toda afirmação sobre performance deve ter o número que a justifica
- Relatório no chat: resumo com KPIs + 3 recomendações. Para PDF completo: seção Relatórios`

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
  { name: "create_adset", description: "Cria um novo conjunto de anúncios. OBRIGATÓRIO: targeting com geo_locations (use search_geo para obter o key de cidades) e advantage_audience (0 = público manual, 1 = Advantage+ automático — SEMPRE perguntar ao usuário). Para LEAD_GENERATION/CONVERSATIONS/POST_ENGAGEMENT incluir page_id. Para OFFSITE_CONVERSIONS incluir pixel_id. Para CONVERSATIONS incluir destination_type='WHATSAPP'. campaign_objective ajuda a inferir optimization_goal automaticamente. CBO: NÃO passe daily_budget nem lifetime_budget (orçamento já está na campanha). ABO: passe daily_budget ou lifetime_budget. NUNCA defina bid_amount.", input_schema: { ...o, properties: { campaign_id: s, name: s, campaign_objective: s, optimization_goal: s, billing_event: s, daily_budget: n, lifetime_budget: n, targeting: { type: "object" as const }, advantage_audience: { type: "number" as const, enum: [0, 1], description: "0 = público manual (respeita interesses/geo), 1 = Advantage+ (Meta expande automaticamente)" }, page_id: s, pixel_id: s, custom_event_type: s, destination_type: s, promoted_object: { type: "object" as const }, start_time: s, end_time: s }, required: ["campaign_id", "name", "targeting", "advantage_audience"] } },
  { name: "update_adset", description: "Atualiza campos de um conjunto de anúncios. NUNCA defina bid_amount.", input_schema: { ...o, properties: { adset_id: s, name: s, status: s, daily_budget: n, lifetime_budget: n, targeting: { type: "object" as const } }, required: ["adset_id"] } },
  { name: "duplicate_adset", description: "Duplica um conjunto de anúncios.", input_schema: { ...o, properties: { adset_id: s, campaign_id: s }, required: ["adset_id"] } },
  { name: "delete_adset",    description: "Deleta um conjunto de anúncios.", input_schema: { ...o, properties: { adset_id: s }, required: ["adset_id"] } },

  // ── Ads — Read
  { name: "get_ads",          description: "Lista os anúncios de uma campanha com criativos.", input_schema: { ...o, properties: { campaign_id: s }, required: ["campaign_id"] } },
  { name: "get_ads_by_adset", description: "Lista os anúncios de um conjunto de anúncios.", input_schema: { ...o, properties: { adset_id: s }, required: ["adset_id"] } },
  { name: "get_ad_insights",  description: "Métricas detalhadas de um anúncio específico.", input_schema: { ...o, properties: { ad_id: s, date_preset: s }, required: ["ad_id"] } },

  // ── Ads — Write
  { name: "create_ad", description: "Cria um anúncio completo com criativo. UTM é injetado automaticamente. Para imagem: forneça image_hash + link_url. Para vídeo: forneça video_id + link_url. Para LEAD_GENERATION (formulário nativo Meta): forneça lead_gen_form_id + optimization_goal='LEAD_GENERATION' (sem link_url). page_id é sempre obrigatório exceto quando reusando creative_id.", input_schema: { ...o, properties: { adset_id: s, name: s, page_id: s, headline: s, body: s, link_url: s, cta: s, image_hash: s, video_id: s, lead_gen_form_id: s, optimization_goal: s, instagram_actor_id: s, caption: s, description: s, utm_tags: s, creative_id: s, status: s }, required: ["adset_id", "name"] } },
  { name: "update_ad",    description: "Atualiza status ou nome de um anúncio.", input_schema: { ...o, properties: { ad_id: s, status: s, name: s }, required: ["ad_id"] } },
  { name: "duplicate_ad", description: "Duplica um anúncio, opcionalmente para outro ad set.", input_schema: { ...o, properties: { ad_id: s, adset_id: s }, required: ["ad_id"] } },
  { name: "delete_ad",    description: "Deleta um anúncio.", input_schema: { ...o, properties: { ad_id: s }, required: ["ad_id"] } },

  // ── Pages
  { name: "get_pages", description: "Lista as Páginas do Facebook vinculadas ao token. SEMPRE chame antes de qualquer operação que precise de page_id — nunca peça o page_id ao usuário se ainda não chamou get_pages.", input_schema: { ...o, properties: {} } },

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

  // ── Geo search — OBRIGATÓRIO antes de criar targeting por cidade/região
  { name: "search_geo", description: "Busca o key de localização para usar no targeting. SEMPRE chame antes de montar geo_locations com cidade ou região. Ex: search_geo('São Paulo') retorna o key correto.", input_schema: { ...o, properties: { query: s, type: { type: "string", enum: ["city", "region", "zip"], description: "Tipo de localização. Default: city" } }, required: ["query"] } },

  // ── Interest search — OBRIGATÓRIO antes de incluir interesses no targeting
  { name: "search_interests", description: "Busca interesses válidos da Meta para usar no targeting. SEMPRE chame antes de incluir qualquer interesse — NUNCA use IDs de memória ou inventados. Ex: search_interests('empreendedorismo') retorna id e name reais.", input_schema: { ...o, properties: { query: s }, required: ["query"] } },

  // ── WhatsApp check (SOMENTE para verificar notificações do sistema GTPRO — NÃO usar para campanhas Meta)
  { name: "check_whatsapp_status", description: "Verifica se o WhatsApp de notificações do GTPRO está configurado. NÃO use para verificar campanhas de WhatsApp do Meta Ads — isso é gerenciado pelo Meta Business Manager.", input_schema: { ...o, properties: {} } },

  // ── Internal
  { name: "create_alert", description: "Registra um alerta interno no sistema.", input_schema: { ...o, properties: { type: { type: "string", enum: ["roas_baixo", "cpl_alto", "budget_esgotado", "campanha_rejeitada", "queda_performance"] }, message: s, campaign_id: s }, required: ["type", "message"] } },
]

const WRITE_TOOLS = new Set(["create_campaign","update_campaign","duplicate_campaign","delete_campaign","toggle_campaign","create_adset","update_adset","duplicate_adset","delete_adset","create_ad","update_ad","duplicate_ad","delete_ad","create_lookalike_audience","create_website_audience","create_engagement_audience"])

async function executeTool(name: string, input: Record<string, any>, tenantId: string) {
  const supabase = createServiceClient()

  if (name === "get_account_info")       return getAccountInfo(tenantId)
  if (name === "get_campaigns")          return getCampaigns(tenantId, input.date_preset ?? "last_7d")
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
  if (name === "get_pages")              return getPages(tenantId)
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

  if (name === "search_geo") {
    const locType = (input.type ?? "city") as "city" | "region" | "zip"
    const results = await searchGeoLocation(tenantId, input.query, locType)
    if (!results.length) return { results: [], message: `Nenhum resultado para "${input.query}". Tente outro nome ou grafia.` }
    return { results, usage: `Use o campo "key" do resultado desejado em geo_locations.cities[].key. Raio mínimo: 15km, recomendado: 25km.` }
  }

  if (name === "search_interests") {
    const results = await searchInterests(tenantId, input.query)
    if (!results.length) return { results: [], message: `Nenhum interesse encontrado para "${input.query}". Tente outro termo.` }
    return { results, usage: `Use o campo "id" e "name" em targeting.interests[]. Estes são os únicos IDs válidos — nunca use IDs de outra fonte.` }
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
  adAccountId?: string,
  onChunk?: (chunk: AgentChunk) => void
) {
  const apiKey = await getAnthropicKey()
  const client = new Anthropic({ apiKey })
  const model  = ALLOWED_MODELS.includes(modelId ?? "") ? modelId! : "claude-sonnet-4-6"

  const namingCtx = tenantConfig.campaign_naming_template
    ? `\nTemplate de nomenclatura de campanhas: "${tenantConfig.campaign_naming_template}" — SEMPRE siga este template ao nomear campanhas.`
    : ""

  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", timeZone: "America/Sao_Paulo" })
  const configCtx = `Data de hoje: ${today}. Configurações: objetivo=${tenantConfig.objetivo_principal}, ROAS mín=${tenantConfig.roas_minimo}, CPL máx=R$${tenantConfig.cpl_maximo}, budget mensal=R$${tenantConfig.budget_mensal ?? "não definido"}, modo supervisionado=${tenantConfig.modo_supervisionado ? "ATIVO" : "DESATIVADO"}. Conta de anúncios ativa: ${adAccountId ?? "padrão"} — use SOMENTE esta conta em todas as operações.${namingCtx}`

  const prior: Anthropic.MessageParam[] = (history ?? [])
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role as "user" | "assistant", content: m.content }))

  // Inject configCtx always — naming template and account must be present in every turn
  const userContent = `${configCtx}\n\n${message}`
  const messages: Anthropic.MessageParam[] = [...prior, { role: "user", content: userContent }]

  const actionsTaken: any[] = []
  const toolsUsed: { name: string; input: Record<string, any> }[] = []
  let iterations = 0
  const MAX_ITERATIONS = 20

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

  while (iterations < MAX_ITERATIONS) {
    iterations++
    const stream = client.messages.stream({
      model, max_tokens: 4096, system: SYSTEM_PROMPT, tools: TOOLS, messages
    })

    stream.on("text", (text) => {
      onChunk?.({ type: "text", delta: text })
    })

    const response = await stream.finalMessage()
    messages.push({ role: "assistant", content: response.content })
    trackUsage(response.usage)

    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find(b => b.type === "text")
      const finalMsg = (textBlock as any)?.text ?? ""
      onChunk?.({ type: "done", message: finalMsg, tools_used: toolsUsed, actions_taken: actionsTaken })
      return { message: finalMsg, actions_taken: actionsTaken, tools_used: toolsUsed }
    }

    if (response.stop_reason === "tool_use") {
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== "tool_use") continue
        onChunk?.({ type: "tool_start", name: block.name, input: block.input as any })
        toolsUsed.push({ name: block.name, input: block.input as any })
        try {
          const result = await executeTool(block.name, block.input as any, tenantId)
          logAction(tenantId, block.name, block.input, result, "success")
          onChunk?.({ type: "tool_done", name: block.name })
          if (WRITE_TOOLS.has(block.name)) {
            actionsTaken.push({ tool: block.name, input: block.input, result })
            onChunk?.({ type: "action", tool: block.name, input: block.input as any, result })
          }
          results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) })
        } catch (e: any) {
          logAction(tenantId, block.name, block.input, { error: e.message }, "failed")
          onChunk?.({ type: "tool_error", name: block.name, error: e.message })
          results.push({ type: "tool_result", tool_use_id: block.id, content: `Erro: ${e.message}`, is_error: true })
        }
      }
      messages.push({ role: "user", content: results })
    }
  }

  const fallback = "Limite de iterações atingido."
  onChunk?.({ type: "done", message: fallback, tools_used: toolsUsed, actions_taken: actionsTaken })
  return { message: fallback, actions_taken: actionsTaken, tools_used: toolsUsed }
}
