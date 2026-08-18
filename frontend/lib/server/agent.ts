import Anthropic from "@anthropic-ai/sdk"
import { getAnthropicKey } from "./platform"
import { createServiceClient } from "./supabase"
import { sendText } from "./whatsapp"
import { createAsaasCharge } from "./asaas"
import {
  getCampaigns, getInsights, getCampaignInsights, getAdSetInsights, getAdInsights, getInsightsByBreakdown,
  createCampaign, updateCampaign, duplicateCampaign, deleteCampaign, toggleCampaign,
  getAdSets, getAdSetById, createAdSet, updateAdSet, duplicateAdSet, deleteAdSet,
  getAds, getAdsByAdSet, updateAd, duplicateAd, deleteAd, createAd,
  getPixels, getPixelStats, getCustomConversions,
  getCustomAudiences, createLookalikeAudience, createWebsiteAudience, createEngagementAudience,
  getAccountInfo, searchGeoLocation, getPages, searchInterests,
  runWithMetaConnection,
} from "./meta-ads"
import {
  getGoogleCampaigns, createGoogleCampaign, toggleGoogleCampaign, updateGoogleCampaignBudget,
  getGoogleInsights, getAdGroups, createAdGroup, updateAdGroupStatus,
  getKeywords, createKeywords, addNegativeKeywords,
  createResponsiveSearchAd, updateAdStatus, getGoogleConnections,
} from "./google-ads"
import { getGA4Connections, getGA4Overview, getGA4ConversionsDaily, getGA4TopPages } from "./ga4"
import { getGTMConnections, getGTMTriggers, createGTMTrigger, getGTMTags, createGTMTag, publishGTMWorkspace } from "./gtm"

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

const SYSTEM_PROMPT = `Você é o GTPRO, especialista em Meta Ads, Google Ads, Google Analytics 4 e Google Tag Manager com acesso completo às APIs. Cria, edita e otimiza campanhas de verdade — não apenas sugere.

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

── TRANSPARÊNCIA DE ERRO — REGRA ABSOLUTA ──
- SEMPRE transcreva ao usuário a mensagem de erro EXATA retornada pela ferramenta: código, subcódigo, Título, Detalhe e fbtrace_id quando presentes.
- NUNCA invente causa ("instabilidade", "limitação da API", "problema do Meta") que não esteja literalmente na mensagem de erro.
- NUNCA diagnostique configuração de conta (vínculos, permissões) sem que o erro diga isso explicitamente.

────────────────────────────────────────
NOMENCLATURA — OBRIGATÓRIO
────────────────────────────────────────
- Se houver template configurado, SEMPRE aplique ao criar campanhas, conjuntos e anúncios
- Substitua variáveis pelos valores reais: [OBJETIVO], [PÚBLICO], [DATA], [NICHO]
- Sem template: use formato [OBJETIVO] - [PÚBLICO-ALVO] - [DATA DD/MM] (ex: "LEAD - Mulheres SP 25-55 - 05/08")
- Conjuntos: mesmo padrão + sufixo conjunto (ex: "LEAD - Mulheres SP 25-55 - 05/08 | Conj.1")
- Anúncios: mesmo padrão + sufixo anúncio (ex: "LEAD - Mulheres SP 25-55 - 05/08 | Anuncio 1")
- A data usada é a data de início da campanha (start_time) ou hoje se não agendada

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
Quando o usuário não tiver o image_hash ou video_id disponível:
1. Crie a campanha e o conjunto normalmente no Meta (create_campaign + create_adset)
2. NÃO chame create_ad ainda — a API exige mídia aprovada
3. Peça a mídia AQUI MESMO, nunca mande o usuário para o Gerenciador de Anúncios:
   "Campanha e conjunto criados (pausado). Agora preciso da imagem ou vídeo do anúncio. Use o clipe de papel no campo de mensagem para enviar o arquivo aqui."
4. Quando o usuário enviar a mídia, você receberá uma mensagem com o image_hash ou video_id — use imediatamente no create_ad para completar a criação.
5. Somente após criar o anúncio confirme: "Anúncio criado. Pronto para ativar quando quiser."

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
- create_ad: SEMPRE passe cta: "WHATSAPP_MESSAGE" — NÃO passe link_url (o link api.whatsapp.com/send é injetado automaticamente). Se o usuário forneceu mensagem de boas-vindas, passe em page_welcome_message

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
- ABO vs CBO — ERRO GRAVE JÁ ACONTECEU AQUI (campanha virou CBO sem querer, cliente perdeu o aprendizado e teve que duplicar a campanha pra consertar). Antes de qualquer aumento ou redução de orçamento, PASSO OBRIGATÓRIO:
  1. Chame get_campaigns (ou já use o resultado se tiver acabado de chamar) e confira o campo daily_budget/lifetime_budget da CAMPANHA: se estiver preenchido, a campanha é CBO. Se estiver vazio/nulo, é ABO (orçamento fica nos conjuntos).
  2. Diga ao usuário qual das duas é, e CONFIRME antes de executar — mesmo se parecer óbvio.
  3. Campanha CBO → update_campaign. Campanha ABO → update_adset, uma chamada por conjunto.
  4. NUNCA use update_campaign com daily_budget/lifetime_budget numa campanha que hoje é ABO — isso liga o CBO e apaga os orçamentos individuais dos conjuntos.
  5. Depois de executar, confirme de volta o nível exato alterado (campanha/CBO ou conjunto/ABO) e o id usado.
- Orientação de mercado (não regra técnica verificada): mudança de orçamento acima de ~20% tende a resetar a fase de aprendizado do conjunto. Avise o usuário quando pedir mudança maior que isso.

────────────────────────────────────────
TROCA DE CRIATIVO
────────────────────────────────────────
- Pra trocar criativo NÃO precisa duplicar campanha nem conjunto — mas editar o anúncio existente (update_ad) reseta a fase de aprendizado DESSE anúncio.
- Forma certa: use create_ad pra criar um anúncio NOVO no mesmo conjunto, deixando o antigo rodando junto. NUNCA edite direto um anúncio que já está performando bem — isso destrói o histórico dele à toa.
- Só pause o anúncio antigo depois que o novo tiver dado suficiente pra comparar — nunca antes.
- Se a frequência estiver alta e o público não puder ser expandido (ex: campanha geolocalizada), trocar criativo é a ação certa mesmo assim — não existe outra alavanca nesse caso, e o reset da fase de aprendizado é um custo aceitável.

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
7. Agendamento — "Quando quer ativar a campanha? (Hoje / Data específica DD/MM/AAAA / Só quando você confirmar manualmente)" — Se data informada, converta para ISO 8601 e passe em start_time no create_adset. Se "hoje" ou "manual", não defina start_time.
8. Criativo — "Tem a imagem ou vídeo do anúncio? Use o clipe de papel aqui no chat para fazer o upload." (NUNCA peça image_hash ou video_id diretamente — o usuário não sabe o que é isso; o sistema converte o arquivo e te manda o hash automaticamente)
   — Se objetivo for OUTCOME_MESSAGES/WhatsApp: pergunte também "Qual mensagem o usuário receberá ao clicar? (ex: 'Olá! Vim pelo anúncio e quero saber mais.')" e passe em page_welcome_message
9. Copy — (se não tiver) gere 3 opções e peça para o usuário escolher
10. RESUMO — apresente tudo estruturado e pergunte "Posso criar?"

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
GOOGLE ADS — REGRAS OBRIGATÓRIAS
────────────────────────────────────────
- Toda campanha nasce PAUSED, todo grupo de anúncios nasce ENABLED (o pai pausado já impede veiculação), todo anúncio nasce PAUSED. Só ative quando o usuário confirmar.
- Orçamento (daily_budget) é SEMPRE em reais (BRL) — o código converte para micros automaticamente. NUNCA envie o valor já convertido.
- Fluxo obrigatório de criação, uma pergunta por vez, mesma disciplina do Meta Ads:
  1. Objetivo/nicho do cliente e canal — SEARCH (busca, precisa de palavras-chave), DISPLAY (rede de display) ou PERFORMANCE_MAX (automatizada, sem grupo/palavra-chave manual)
  2. Nome da campanha e orçamento diário
  3. create_google_campaign → guarde o campaign_resource_name retornado
  4. Para SEARCH/DISPLAY: pergunte o nome do grupo de anúncios → create_google_adgroup com o campaign_resource_name
  5. Para SEARCH: pergunte as palavras-chave (com termos que o cliente já usa) e o match type desejado (padrão PHRASE se não especificado) → create_google_keywords com o adgroup_resource_name retornado. Pergunte também se há termos a excluir (palavras-chave negativas)
  6. Peça a URL de destino, 3 a 15 headlines (máx. 30 caracteres) e 2 a 4 descriptions (máx. 90 caracteres) — se o usuário não tiver copy pronta, gere opções e peça confirmação
  7. create_google_ad com esse material
  8. Resuma a estrutura completa (campanha → grupo → palavras-chave → anúncio) e pergunte se pode ativar
- PERFORMANCE_MAX não usa grupo de anúncios nem palavra-chave manual — depois de create_google_campaign, oriente o cliente a configurar assets no próprio Google Ads ou avise que a criação completa de PMax via chat ainda não está disponível.
- toggle_google_campaign já propaga o status para todos os grupos e anúncios da campanha — não é preciso ativar cada um manualmente depois.
- Antes de qualquer análise, confira com get_google_accounts qual conta (cliente da agência) está ativa — nunca assuma.
- Ao mencionar a conta ativa, use SEMPRE account_name (nome do cliente) retornado por get_google_accounts — NUNCA mostre account_customer_id cru a menos que o nome esteja vazio, aí sim use o ID formatado como fallback.
- Se o usuário pedir "o ID da conta", é SEMPRE account_customer_id. O campo agency_mcc_id_do_not_use_as_account_id é o ID da MCC da agência (uso interno de autenticação) — NUNCA apresente esse valor como se fosse o ID da conta do cliente, mesmo que pareça relevante.
- ROAS e CPA do Google Ads já vêm calculados pela ferramenta (spend/conversions e conv_value/spend) — não recalcule a partir de campos brutos.
- Erros da API do Google Ads vêm com código interno (ex: "REQUIRED_FIELD_MISSING", "AD_GROUP_STATUS") — transcreva a mensagem exata ao usuário, mesma regra de transparência do Meta Ads.

────────────────────────────────────────
GOOGLE ANALYTICS 4 (GA4) — SOMENTE LEITURA
────────────────────────────────────────
- Antes de qualquer análise de tráfego, confira com get_ga4_properties qual propriedade está ativa — nunca assuma.
- GA4 é dado de SITE (sessões, usuários, páginas), não de campanha — não confunda com métricas do Meta/Google Ads. Se o usuário pedir "como está o tráfego" ou "de onde vêm as visitas", use get_ga4_overview (traz por canal: orgânico, pago, direto, social etc).
- Para tendência ao longo do tempo, use get_ga4_conversions_daily. Para saber quais páginas convertem mais, use get_ga4_top_pages.
- Conversas iniciadas no Meta/Google Ads e "conversions" do GA4 são medidas por sistemas DIFERENTES com metodologias diferentes — NUNCA some ou compare diretamente sem avisar que as fontes são diferentes.
- GA4 é somente leitura — não existe ferramenta de escrita para GA4 nesta versão.

────────────────────────────────────────
GOOGLE TAG MANAGER (GTM) — REGRAS OBRIGATÓRIAS
────────────────────────────────────────
- Antes de criar qualquer coisa, confira com get_gtm_containers qual container está ativo — nunca assuma.
- Tag depende de gatilho: SEMPRE crie (ou identifique com get_gtm_triggers) o gatilho ANTES da tag, e passe o ID dele em trigger_ids. Uma tag sem gatilho nunca dispara.
- Fluxo de criação, uma pergunta por vez, mesma disciplina do Meta/Google Ads:
  1. O que a tag precisa medir (conversão do Google Ads, evento GA4, ou script customizado) e QUANDO deve disparar (carregou página X, clicou em Y, enviou formulário)
  2. Se o gatilho pedido ainda não existir, create_gtm_trigger primeiro — guarde o id retornado
  3. create_gtm_tag usando esse trigger_id
  4. Resuma o que foi criado (gatilho + tag) e pergunte se pode publicar
- publish_gtm_workspace é o único jeito de colocar no ar — sem publicar, a tag fica só no rascunho, invisível no site do cliente. NUNCA publique sem confirmação explícita do usuário, mesmo em modo não supervisionado — publicar afeta o site ao vivo do cliente imediatamente.
- kind=google_ads_conversion precisa do conversion_id (o AW-XXXXXXXXX da conta) e do conversion_label (da ação de conversão específica) — se o usuário não souber esses valores, oriente a pegar em Google Ads → Ferramentas → Conversões → clicar na ação → Configuração da tag.
- Erros do GTM: transcreva a mensagem exata, mesma regra de transparência das outras plataformas.

────────────────────────────────────────
COBRANÇAS (BOLETO / PIX) — ASAAS
────────────────────────────────────────
Quando o usuário pedir para gerar boleto, cobrança ou link de pagamento:
1. Solicite (uma por vez): nome do cliente, WhatsApp do cliente, descrição, valor, data de vencimento (DD/MM/AAAA), tipo (Boleto ou PIX)
2. Converta a data para YYYY-MM-DD antes de passar ao generate_charge
3. Após gerar, confirme: "Cobrança criada e link enviado por WhatsApp: [link]"
4. NUNCA pergunte CPF — só solicite se o cliente pedir nota fiscal ou o sistema exigir

────────────────────────────────────────
INTEGRIDADE DE DADOS — REGRA ABSOLUTA
────────────────────────────────────────
- NUNCA some métricas de campanhas diferentes para produzir um "total" sem declarar que é uma soma manual.
- Métricas de alcance (Reach) e conversas/trocas têm deduplicação cross-campanha pelo Meta: a soma por campanha SERÁ maior que o total da conta. Isso é correto — explique ao usuário se ele perceber.
- Se apresentar um total e a soma das partes não bater, DECLARE EXPLICITAMENTE: "esses totais vêm da API com deduplicação" ou "somo individualmente: X+Y+Z = W".
- Ao mostrar "Investimento total: R$X" em uma análise multi-campanha, CONFIRME que X = soma das campanhas listadas — nunca misture com o total da conta (que inclui pausadas).
- Se chamar get_campaigns e depois get_account_insights, os dois podem retornar valores diferentes para o mesmo período. Use get_campaigns como fonte principal para análise de campanhas ativas.
- Se o usuário disser que um número (seguidores, visitas de perfil, etc.) não bate com o Gerenciador de Anúncios: NÃO insista no valor calculado. Cada campanha retorna raw_actions (lista de action_type + value sem filtro nenhum) — procure ali o action_type que corresponde ao que o usuário está pedindo e use o valor direto dele, explicando qual action_type você usou. Nunca invente ou chute um action_type novo.
- "Seguidores novos" e "Visitas ao perfil" NÃO existem em raw_actions/actions da API de Insights — são colunas calculadas só na interface do Gerenciador de Anúncios, cruzando dado de Página/Perfil que a API pública não expõe da mesma forma. NUNCA estime ou calcule esses dois números a partir de outras métricas (é isso que já causou erro grave antes). Se o usuário pedir, diga direto que esses dois números específicos só existem no Gerenciador de Anúncios, não na API — não tente aproximar.

────────────────────────────────────────
JANELA DE TEMPO — REGRA ABSOLUTA
────────────────────────────────────────
- Toda métrica derivada (CPL, CPA, custo/conversa, ROAS) deve usar SOMENTE campos do MESMO objeto retornado pela MESMA chamada de ferramenta, com o MESMO date_preset ou time_range.
- NUNCA divida spend de uma chamada por conversas/leads/compras de outra chamada com preset diferente.
- Se precisar mudar o período de análise, re-chame get_campaigns ou get_campaign_insights com o novo preset e use SOMENTE os dados dessa nova chamada — descarte os números anteriores.
- O sufixo "_7d" em "messaging_conversation_started_7d" é o NOME DA JANELA DE ATRIBUIÇÃO do Meta (crédita conversas iniciadas em até 7 dias após o clique). Não é um filtro de período. O período de relatório é sempre o date_preset que você passou.
- Cada objeto de métricas tem um campo _period que indica o período de origem. NUNCA combine campos de objetos com _period diferentes em um único cálculo.

────────────────────────────────────────
REGRAS GERAIS
────────────────────────────────────────
- Saudações e perguntas simples: responda sem chamar ferramentas
- Modo supervisionado ATIVO: descreva o que vai fazer e pergunte "Posso executar?" antes de qualquer escrita
- Modo supervisionado DESATIVADO: execute diretamente
- NUNCA pergunte "em qual conta?" — use a conta do contexto
- NUNCA delete sem confirmação explícita
- Toda afirmação sobre performance deve ter o número que a justifica
- Relatório no chat: resumo com KPIs + 3 recomendações. Para PDF completo: seção Relatórios

────────────────────────────────────────
NUNCA RESPONDA DE MEMÓRIA — REGRA ABSOLUTA
────────────────────────────────────────
- TODA pergunta sobre conta, conexão, campanha, grupo, anúncio, palavra-chave, métrica, orçamento ou status — mesmo que pareça uma pergunta nova, mesmo que você tenha certeza da resposta, mesmo que os mesmos dados já tenham aparecido antes NESTA MESMA conversa — exige uma chamada de ferramenta nova ANTES de responder. Sem exceção. Dado antigo na conversa NUNCA é fonte válida pra essas respostas, nem quando parece óbvio ou repetitivo.
- Isso vale pra qualquer forma de pergunta, não só "tenta de novo" — inclui "temos X?", "tem campanha ativa?", "quantas contas?", "qual o status?", "quais campanhas?" e qualquer variação. Se a pergunta pode ser respondida checando alguma ferramenta, chame a ferramenta — não existe pergunta "óbvia demais pra verificar de novo".
- Antes de escrever a resposta final, se a pergunta menciona conta/campanha/métrica/status e a última mensagem sua no histórico não tem uma chamada de ferramenta correspondente A ESTE turno específico, você está prestes a responder de memória — pare e chame a ferramenta primeiro.
- Erro anterior não significa que vai falhar de novo — sempre re-execute antes de afirmar que algo não está conectado ou não existe.

────────────────────────────────────────
NUNCA MISTURE DADO DE PLATAFORMAS DIFERENTES — REGRA ABSOLUTA
────────────────────────────────────────
- Meta Ads e Google Ads são contas, tokens e dados completamente diferentes, mesmo dentro da mesma conversa.
- PROIBIDO montar uma afirmação usando nome/dado de uma chamada (ex: business_name de get_account_info do Meta) junto com ID/dado de uma chamada de outra plataforma (ex: customer_id de get_google_accounts). Cada fato sobre "conta ativa" tem que vir INTEIRO da MESMA chamada de ferramenta — nunca combine campos de respostas diferentes, e nunca reaproveite um nome mencionado antes na conversa para rotular uma conta de outra plataforma.
- Se não tiver certeza de qual chamada originou um dado, chame a ferramenta de novo em vez de arriscar.
- Ao responder "qual é a conta ativa" de uma plataforma específica, use SOMENTE os campos retornados pela chamada daquela plataforma feita NA MESMA resposta.`

const o = { type: "object" as const }
const s = { type: "string" as const }
const n = { type: "number" as const }
const b = { type: "boolean" as const }

const TOOLS: Anthropic.Tool[] = [
  // ── Account
  { name: "get_account_info",       description: "Informações da conta: moeda, fuso, saldo, limite de gasto.", input_schema: { ...o, properties: {} } },

  // ── Campaigns — Read
  { name: "get_campaigns",          description: "Lista todas as campanhas com métricas e orçamentos.", input_schema: { ...o, properties: { date_preset: s } } },
  { name: "get_campaign_insights",  description: "Métricas detalhadas de uma campanha específica. Use since+until para janela exata (YYYY-MM-DD), ou date_preset para janelas predefinidas. Nunca misture os dois.", input_schema: { ...o, properties: { campaign_id: s, date_preset: s, since: s, until: s }, required: ["campaign_id"] } },
  { name: "get_insights_breakdown", description: "Insights com breakdown por age, gender, placement, device, region etc.", input_schema: { ...o, properties: { breakdown: s, date_preset: s }, required: ["breakdown"] } },
  { name: "get_account_insights",   description: "Métricas agregadas da conta inteira.", input_schema: { ...o, properties: { date_preset: s } } },

  // ── Campaigns — Write
  { name: "create_campaign", description: "Cria uma nova campanha. Sempre cria como PAUSED por padrão.", input_schema: { ...o, properties: { name: s, objective: s, daily_budget: n, lifetime_budget: n, start_time: s, stop_time: s, special_ad_categories: { type: "array", items: s } }, required: ["name", "objective"] } },
  { name: "update_campaign", description: "Atualiza campos de uma campanha: nome, status, datas. ATENÇÃO CRÍTICA sobre daily_budget/lifetime_budget aqui: definir orçamento no nível de CAMPANHA liga o Advantage Campaign Budget (CBO) e DESATIVA os orçamentos individuais dos conjuntos de anúncios — não é só mudar um número, é uma mudança estrutural que redistribui o orçamento entre os conjuntos automaticamente. Se os conjuntos já têm orçamento próprio (ABO) e o usuário quer mudar o valor de um ou mais conjuntos específicos, é ERRADO usar esta ferramenta — use update_adset em cada conjunto individualmente. Só use orçamento aqui quando o usuário pedir explicitamente orçamento no nível de campanha/CBO/Advantage+.", input_schema: { ...o, properties: { campaign_id: s, name: s, status: s, daily_budget: n, lifetime_budget: n, start_time: s, stop_time: s }, required: ["campaign_id"] } },
  { name: "duplicate_campaign", description: "Duplica uma campanha (deep copy, cria como PAUSED).", input_schema: { ...o, properties: { campaign_id: s, new_name: s }, required: ["campaign_id"] } },
  { name: "delete_campaign",    description: "Deleta permanentemente uma campanha.", input_schema: { ...o, properties: { campaign_id: s }, required: ["campaign_id"] } },
  { name: "toggle_campaign",    description: "Ativa ou pausa uma campanha.", input_schema: { ...o, properties: { campaign_id: s, status: { type: "string", enum: ["ACTIVE", "PAUSED"] } }, required: ["campaign_id", "status"] } },

  // ── Ad Sets — Read
  { name: "get_adsets",         description: "Lista os conjuntos de anúncios de uma campanha.", input_schema: { ...o, properties: { campaign_id: s }, required: ["campaign_id"] } },
  { name: "get_adset",          description: "Detalhes de um conjunto de anúncios específico, incluindo targeting.", input_schema: { ...o, properties: { adset_id: s }, required: ["adset_id"] } },
  { name: "get_adset_insights", description: "Métricas detalhadas de um conjunto de anúncios. Use since+until para janela exata (YYYY-MM-DD), ou date_preset para janelas predefinidas. Nunca misture os dois.", input_schema: { ...o, properties: { adset_id: s, date_preset: s, since: s, until: s }, required: ["adset_id"] } },

  // ── Ad Sets — Write
  { name: "create_adset", description: "Cria um novo conjunto de anúncios. OBRIGATÓRIO: targeting com geo_locations (use search_geo para obter o key de cidades) e advantage_audience (0 = público manual, 1 = Advantage+ automático — SEMPRE perguntar ao usuário). Para LEAD_GENERATION/CONVERSATIONS/POST_ENGAGEMENT incluir page_id. Para OFFSITE_CONVERSIONS incluir pixel_id. Para CONVERSATIONS incluir destination_type='WHATSAPP'. campaign_objective ajuda a inferir optimization_goal automaticamente. CBO: NÃO passe daily_budget nem lifetime_budget (orçamento já está na campanha). ABO: passe daily_budget ou lifetime_budget. NUNCA defina bid_amount.", input_schema: { ...o, properties: { campaign_id: s, name: s, campaign_objective: s, optimization_goal: s, billing_event: s, daily_budget: n, lifetime_budget: n, targeting: { type: "object" as const }, advantage_audience: { type: "number" as const, enum: [0, 1], description: "0 = público manual (respeita interesses/geo), 1 = Advantage+ (Meta expande automaticamente)" }, page_id: s, pixel_id: s, custom_event_type: s, destination_type: s, promoted_object: { type: "object" as const }, start_time: s, end_time: s }, required: ["campaign_id", "name", "targeting", "advantage_audience"] } },
  { name: "update_adset", description: "Atualiza campos de um conjunto de anúncios, incluindo orçamento (ABO). Este é o jeito CORRETO de mudar orçamento quando o usuário fala em 'conjunto(s)' especificamente, ou quando cada conjunto tem orçamento próprio — NUNCA use update_campaign pra isso, converte pra CBO e desativa o orçamento individual. Se há múltiplos conjuntos a atualizar, chame esta ferramenta uma vez PARA CADA adset_id — nunca tente resolver vários conjuntos com uma chamada só. NUNCA defina bid_amount.", input_schema: { ...o, properties: { adset_id: s, name: s, status: s, daily_budget: n, lifetime_budget: n, targeting: { type: "object" as const } }, required: ["adset_id"] } },
  { name: "duplicate_adset", description: "Duplica um conjunto de anúncios.", input_schema: { ...o, properties: { adset_id: s, campaign_id: s }, required: ["adset_id"] } },
  { name: "delete_adset",    description: "Deleta um conjunto de anúncios.", input_schema: { ...o, properties: { adset_id: s }, required: ["adset_id"] } },

  // ── Ads — Read
  { name: "get_ads",          description: "Lista os anúncios de uma campanha com criativos.", input_schema: { ...o, properties: { campaign_id: s }, required: ["campaign_id"] } },
  { name: "get_ads_by_adset", description: "Lista os anúncios de um conjunto de anúncios.", input_schema: { ...o, properties: { adset_id: s }, required: ["adset_id"] } },
  { name: "get_ad_insights",  description: "Métricas detalhadas de um anúncio específico. Use since+until para janela exata (YYYY-MM-DD), ou date_preset para janelas predefinidas. Nunca misture os dois.", input_schema: { ...o, properties: { ad_id: s, date_preset: s, since: s, until: s }, required: ["ad_id"] } },

  // ── Ads — Write
  { name: "create_ad", description: "Cria um anúncio completo com criativo. UTM é injetado automaticamente. Para imagem: forneça image_hash + link_url. Para vídeo: forneça video_id + link_url. Para LEAD_GENERATION: forneça lead_gen_form_id + optimization_goal='LEAD_GENERATION'. Para WhatsApp (CTWA): cta='WHATSAPP_MESSAGE' — o link api.whatsapp.com/send é injetado automaticamente, NÃO passe link_url; opcionalmente passe page_welcome_message com a mensagem de abertura da conversa. page_id é sempre obrigatório exceto quando reusando creative_id.", input_schema: { ...o, properties: { adset_id: s, name: s, page_id: s, headline: s, body: s, link_url: s, cta: s, image_hash: s, video_id: s, page_welcome_message: s, lead_gen_form_id: s, optimization_goal: s, instagram_actor_id: s, caption: s, description: s, utm_tags: s, creative_id: s, status: s }, required: ["adset_id", "name"] } },
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

  // ── Asaas (boleto / PIX)
  { name: "generate_charge", description: "Gera cobrança (boleto ou PIX) via Asaas e envia link por WhatsApp. Use quando o usuário pedir para gerar boleto, cobrança ou link de pagamento para um cliente.", input_schema: { ...o, properties: { customer_name: s, customer_phone: s, customer_cpf: s, description: s, value: n, due_date: s, billing_type: { type: "string", enum: ["BOLETO", "PIX", "CREDIT_CARD"], description: "Tipo de pagamento. Default: BOLETO" } }, required: ["customer_name", "customer_phone", "description", "value", "due_date"] } },

  // ── Google Ads — Account
  { name: "get_google_accounts", description: "Lista as contas Google Ads conectadas (MCC/clientes) e qual está ativa no momento.", input_schema: { ...o, properties: {} } },

  // ── Google Ads — Campaigns
  { name: "get_google_campaigns",   description: "Lista campanhas do Google Ads com métricas (spend, conversões, ROAS, CPA) e orçamento.", input_schema: { ...o, properties: { date_preset: { type: "string", enum: ["last_7d", "last_14d", "last_30d", "last_90d", "this_month", "last_month"] } } } },
  { name: "create_google_campaign", description: "Cria uma campanha do Google Ads (SEARCH, DISPLAY ou PERFORMANCE_MAX), sempre como PAUSED. Depois de criar, é preciso criar ao menos um grupo de anúncios (create_google_adgroup) e, para SEARCH, palavras-chave (create_google_keywords) e um anúncio (create_google_ad).", input_schema: { ...o, properties: { name: s, daily_budget: { ...n, description: "Orçamento diário em reais (BRL)" }, channel_type: { type: "string", enum: ["SEARCH", "DISPLAY", "PERFORMANCE_MAX"] } }, required: ["name", "daily_budget", "channel_type"] } },
  { name: "toggle_google_campaign", description: "Ativa ou pausa uma campanha do Google Ads — propaga o status para todos os grupos de anúncios e anúncios da campanha.", input_schema: { ...o, properties: { campaign_id: s, enable: b }, required: ["campaign_id", "enable"] } },
  { name: "update_google_campaign_budget", description: "Atualiza o orçamento diário de uma campanha do Google Ads. budget_resource_name vem pronto no campo budget_resource_name de cada campanha retornada por get_google_campaigns — NUNCA peça esse valor ao usuário, sempre chame get_google_campaigns primeiro se ainda não tiver.", input_schema: { ...o, properties: { budget_resource_name: s, daily_budget: { ...n, description: "Novo orçamento diário em reais (BRL)" } }, required: ["budget_resource_name", "daily_budget"] } },
  { name: "get_google_insights",    description: "Métricas agregadas da conta Google Ads inteira para um período, com série diária.", input_schema: { ...o, properties: { date_preset: { type: "string", enum: ["last_7d", "last_14d", "last_30d", "last_90d", "this_month", "last_month"] } } } },

  // ── Google Ads — Ad Groups
  { name: "get_google_adgroups",    description: "Lista os grupos de anúncios de uma campanha do Google Ads com métricas.", input_schema: { ...o, properties: { campaign_id: s, date_preset: s }, required: ["campaign_id"] } },
  { name: "create_google_adgroup",  description: "Cria um grupo de anúncios dentro de uma campanha do Google Ads. Use o campaign_resource_name retornado por create_google_campaign ou get_google_campaigns.", input_schema: { ...o, properties: { campaign_resource_name: s, name: s, cpc_bid: { ...n, description: "Lance manual por clique em reais (opcional — omitir usa lance automático da campanha)" } }, required: ["campaign_resource_name", "name"] } },
  { name: "toggle_google_adgroup",  description: "Ativa ou pausa um grupo de anúncios do Google Ads.", input_schema: { ...o, properties: { adgroup_resource_name: s, enable: b }, required: ["adgroup_resource_name", "enable"] } },

  // ── Google Ads — Keywords
  { name: "get_google_keywords",    description: "Lista as palavras-chave de um grupo de anúncios com métricas e quality score.", input_schema: { ...o, properties: { adgroup_id: s, date_preset: s }, required: ["adgroup_id"] } },
  { name: "create_google_keywords", description: "Adiciona palavras-chave a um grupo de anúncios do Google Ads. match_type: EXACT (exata), PHRASE (frase) ou BROAD (ampla) — padrão PHRASE.", input_schema: { ...o, properties: { adgroup_resource_name: s, keywords: { type: "array", items: { type: "object", properties: { text: s, match_type: { type: "string", enum: ["EXACT", "PHRASE", "BROAD"] } }, required: ["text"] } } }, required: ["adgroup_resource_name", "keywords"] } },
  { name: "add_google_negative_keywords", description: "Adiciona palavras-chave negativas a um grupo de anúncios, para excluir buscas irrelevantes.", input_schema: { ...o, properties: { adgroup_resource_name: s, keywords: { type: "array", items: { type: "object", properties: { text: s, match_type: { type: "string", enum: ["EXACT", "PHRASE", "BROAD"] } }, required: ["text"] } } }, required: ["adgroup_resource_name", "keywords"] } },

  // ── Google Ads — Ads
  { name: "create_google_ad", description: "Cria um Responsive Search Ad (RSA) num grupo de anúncios. Exige 3–15 headlines (máx. 30 caracteres cada) e 2–4 descriptions (máx. 90 caracteres cada). Sempre criado como PAUSED.", input_schema: { ...o, properties: { adgroup_resource_name: s, headlines: { type: "array", items: s }, descriptions: { type: "array", items: s }, final_url: s, path1: s, path2: s }, required: ["adgroup_resource_name", "headlines", "descriptions", "final_url"] } },
  { name: "toggle_google_ad", description: "Ativa ou pausa um anúncio do Google Ads.", input_schema: { ...o, properties: { ad_resource_name: s, enable: b }, required: ["ad_resource_name", "enable"] } },

  // ── Google Analytics 4 (leitura)
  { name: "get_ga4_properties", description: "Lista as propriedades GA4 conectadas e qual está ativa.", input_schema: { ...o, properties: {} } },
  { name: "get_ga4_overview", description: "Visão geral de tráfego: sessões, usuários, conversões e engajamento por canal (orgânico, pago, direto etc). Use para responder 'como está o tráfego do site'.", input_schema: { ...o, properties: { date_preset: { type: "string", enum: ["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month", "last_month"] } } } },
  { name: "get_ga4_conversions_daily", description: "Série diária de sessões, conversões e receita — use para ver tendência ao longo do tempo.", input_schema: { ...o, properties: { date_preset: s } } },
  { name: "get_ga4_top_pages", description: "Páginas mais visitadas com sessões e conversões — útil para cruzar com landing pages de campanhas.", input_schema: { ...o, properties: { date_preset: s } } },

  // ── Google Tag Manager
  { name: "get_gtm_containers", description: "Lista os containers GTM conectados e qual está ativo.", input_schema: { ...o, properties: {} } },
  { name: "get_gtm_triggers", description: "Lista os gatilhos (triggers) já criados no container ativo.", input_schema: { ...o, properties: {} } },
  { name: "create_gtm_trigger", description: "Cria um gatilho no GTM. Tipos: PAGEVIEW (carregou a página), CLICK (clique em qualquer elemento), LINK_CLICK (clique em link), FORM_SUBMISSION (envio de formulário), CUSTOM_EVENT (evento customizado disparado via dataLayer, exige event_name). url_contains filtra pra só disparar em páginas cuja URL contenha esse trecho (ex: '/obrigado' para página de conversão).", input_schema: { ...o, properties: { name: s, type: { type: "string", enum: ["PAGEVIEW", "CLICK", "LINK_CLICK", "FORM_SUBMISSION", "CUSTOM_EVENT"] }, event_name: s, url_contains: s }, required: ["name", "type"] } },
  { name: "get_gtm_tags", description: "Lista as tags já criadas no container ativo.", input_schema: { ...o, properties: {} } },
  { name: "create_gtm_tag", description: "Cria uma tag no GTM vinculada a um ou mais gatilhos (use os IDs retornados por get_gtm_triggers ou create_gtm_trigger). kind=google_ads_conversion exige conversion_id (AW-XXXXXXXXX) e conversion_label; kind=ga4_event exige measurement_id (G-XXXXXXXXXX) e event_name; kind=custom_html exige html (script bruto, use só quando não houver template pronto).", input_schema: { ...o, properties: { name: s, kind: { type: "string", enum: ["google_ads_conversion", "ga4_event", "custom_html"] }, trigger_ids: { type: "array", items: s }, conversion_id: s, conversion_label: s, conversion_value: s, measurement_id: s, event_name: s, html: s }, required: ["name", "kind", "trigger_ids"] } },
  { name: "publish_gtm_workspace", description: "Publica as tags e gatilhos criados — sem isso eles ficam só no rascunho e não disparam no site do cliente. SEMPRE confirme com o usuário antes de publicar.", input_schema: { ...o, properties: { version_name: s } } },
]

// Prompt caching: system prompt e tools são grandes e idênticos em toda chamada dentro
// do mesmo turno (até 20 iterações) — sem cache_control, cada iteração paga preço cheio
// de novo pelo mesmo prefixo enorme. cache_control no último item de cada array cacheia
// tudo até ali (documentação oficial da Anthropic).
const TOOLS_CACHED: Anthropic.Tool[] = TOOLS.map((t, i) =>
  i === TOOLS.length - 1 ? { ...t, cache_control: { type: "ephemeral" as const } } : t
)

const WRITE_TOOLS = new Set([
  "create_campaign","update_campaign","duplicate_campaign","delete_campaign","toggle_campaign",
  "create_adset","update_adset","duplicate_adset","delete_adset","create_ad","update_ad","duplicate_ad","delete_ad",
  "create_lookalike_audience","create_website_audience","create_engagement_audience","generate_charge",
  "create_google_campaign","toggle_google_campaign","update_google_campaign_budget",
  "create_google_adgroup","toggle_google_adgroup",
  "create_google_keywords","add_google_negative_keywords",
  "create_google_ad","toggle_google_ad",
  "create_gtm_trigger","create_gtm_tag","publish_gtm_workspace",
])

// Guards against duplicate creation if the model retries a write after a transient
// error (or a dropped client connection masks a server-side success). Reuses the
// agent_logs trail already written by logAction — no new table needed.
const DEDUPE_WINDOW_MS = 30_000
const DEDUPE_TOOLS = new Set([
  "create_campaign", "create_adset", "create_ad",
  "create_google_campaign", "create_google_adgroup", "create_google_ad",
  "create_gtm_trigger", "create_gtm_tag",
])

async function findRecentDuplicate(tenantId: string, name: string, input: Record<string, any>): Promise<any | null> {
  const supabase = createServiceClient()
  const since = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString()
  const { data } = await supabase
    .from("agent_logs")
    .select("params, result")
    .eq("tenant_id", tenantId)
    .eq("action", name)
    .eq("status", "success")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5)
  const fingerprint = JSON.stringify(input)
  const match = (data ?? []).find((row: any) => JSON.stringify(row.params) === fingerprint)
  return match?.result ?? null
}

async function executeTool(name: string, input: Record<string, any>, tenantId: string) {
  const supabase = createServiceClient()

  if (DEDUPE_TOOLS.has(name)) {
    const cached = await findRecentDuplicate(tenantId, name, input)
    if (cached) {
      return {
        ...(typeof cached === "object" && cached !== null ? cached : { result: cached }),
        _deduped: true,
        _note: "Ação idêntica já foi executada há poucos segundos — resultado reaproveitado para evitar duplicação no Meta.",
      }
    }
  }

  if (name === "get_account_info")       return getAccountInfo(tenantId)
  if (name === "get_campaigns")          return getCampaigns(tenantId, input.date_preset ?? "last_7d")
  if (name === "get_account_insights")   return getInsights(tenantId, input.date_preset)
  if (name === "get_campaign_insights")  return getCampaignInsights(tenantId, input.campaign_id, input.date_preset, input.since, input.until)
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
  if (name === "get_adset_insights") return getAdSetInsights(tenantId, input.adset_id, input.date_preset, input.since, input.until)
  if (name === "create_adset")       return createAdSet(tenantId, input)
  if (name === "update_adset") {
    const { adset_id, ...params } = input
    return updateAdSet(tenantId, adset_id, params)
  }
  if (name === "duplicate_adset")    return duplicateAdSet(tenantId, input.adset_id, input.campaign_id)
  if (name === "delete_adset")       return deleteAdSet(tenantId, input.adset_id)
  if (name === "get_ads")            return getAds(tenantId, input.campaign_id)
  if (name === "get_ads_by_adset")   return getAdsByAdSet(tenantId, input.adset_id)
  if (name === "get_ad_insights")    return getAdInsights(tenantId, input.ad_id, input.date_preset, input.since, input.until)
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

  if (name === "generate_charge") {
    const charge = await createAsaasCharge(tenantId, {
      customer_name:  input.customer_name,
      customer_phone: input.customer_phone,
      customer_cpf:   input.customer_cpf,
      description:    input.description,
      value:          input.value,
      due_date:       input.due_date,
      billing_type:   input.billing_type ?? "BOLETO",
    })
    // Send link via WhatsApp if configured
    const { data: ac } = await supabase.from("agent_configs").select("whatsapp_number").eq("tenant_id", tenantId).single()
    if (ac?.whatsapp_number) {
      const phone = (ac.whatsapp_number as string).replace(/\D/g, "")
      const link  = charge.invoice_url ?? charge.barcode_url ?? charge.pix_url ?? ""
      if (link) {
        const label = charge.billing_type === "PIX" ? "PIX" : "Boleto"
        try { await sendText(phone, `💰 *${label} gerado via GTPRO*\n\nCliente: ${input.customer_name}\nValor: R$ ${Number(input.value).toFixed(2)}\nVencimento: ${input.due_date}\n\n${link}`) } catch {}
      }
    }
    return charge
  }

  if (name === "get_google_accounts") {
    // Reshape antes de expor ao modelo: manager_customer_id (MCC da agência) e
    // customer_id (a conta do cliente) são fáceis de confundir quando aparecem
    // como dois campos genéricos lado a lado — já causou o modelo apresentar o
    // ID da agência como se fosse o ID da conta do cliente. Nomes de campo
    // deliberadamente inequívocos em vez de confiar só numa regra de prompt.
    const rows = await getGoogleConnections(tenantId)
    return (rows as any[]).map(r => ({
      id:                     r.id,
      account_name:           r.customer_name || null,
      account_customer_id:    r.customer_id,
      is_active:              r.is_active,
      currency:               r.currency_code,
      agency_mcc_id_do_not_use_as_account_id: r.manager_customer_id ?? null,
    }))
  }

  if (name === "get_google_campaigns")   return getGoogleCampaigns(tenantId, input.date_preset ?? "last_7d")
  if (name === "create_google_campaign") return createGoogleCampaign(tenantId, {
    name: input.name, dailyBudget: input.daily_budget, channelType: input.channel_type,
  })
  if (name === "toggle_google_campaign") return toggleGoogleCampaign(tenantId, input.campaign_id, !!input.enable)
  if (name === "update_google_campaign_budget")
    return updateGoogleCampaignBudget(tenantId, input.budget_resource_name, Math.round(input.daily_budget * 1_000_000))
  if (name === "get_google_insights") return getGoogleInsights(tenantId, input.date_preset ?? "last_7d")

  if (name === "get_google_adgroups")   return getAdGroups(tenantId, input.campaign_id, input.date_preset ?? "last_7d")
  if (name === "create_google_adgroup") return createAdGroup(tenantId, {
    campaignResourceName: input.campaign_resource_name,
    name:                 input.name,
    cpcBidMicros:         input.cpc_bid ? Math.round(input.cpc_bid * 1_000_000) : undefined,
  })
  if (name === "toggle_google_adgroup")
    return updateAdGroupStatus(tenantId, input.adgroup_resource_name, input.enable ? "ENABLED" : "PAUSED")

  if (name === "get_google_keywords") return getKeywords(tenantId, input.adgroup_id, input.date_preset ?? "last_7d")
  if (name === "create_google_keywords") return createKeywords(tenantId, {
    adGroupResourceName: input.adgroup_resource_name,
    keywords: (input.keywords ?? []).map((k: any) => ({ text: k.text, matchType: k.match_type })),
  })
  if (name === "add_google_negative_keywords") return addNegativeKeywords(tenantId, {
    adGroupResourceName: input.adgroup_resource_name,
    keywords: (input.keywords ?? []).map((k: any) => ({ text: k.text, matchType: k.match_type })),
  })

  if (name === "create_google_ad") return createResponsiveSearchAd(tenantId, {
    adGroupResourceName: input.adgroup_resource_name,
    headlines:            input.headlines ?? [],
    descriptions:         input.descriptions ?? [],
    finalUrl:             input.final_url,
    path1:                input.path1,
    path2:                input.path2,
  })
  if (name === "toggle_google_ad")
    return updateAdStatus(tenantId, input.ad_resource_name, input.enable ? "ENABLED" : "PAUSED")

  if (name === "get_ga4_properties") {
    const rows = await getGA4Connections(tenantId)
    return (rows as any[]).map(r => ({
      id:            r.id,
      property_name: r.property_name || null,
      account_name:  r.account_name || null,
      property_id:   r.property_id,
      is_active:     r.is_active,
    }))
  }
  if (name === "get_ga4_overview")           return getGA4Overview(tenantId, input.date_preset ?? "last_7d")
  if (name === "get_ga4_conversions_daily")  return getGA4ConversionsDaily(tenantId, input.date_preset ?? "last_30d")
  if (name === "get_ga4_top_pages")          return getGA4TopPages(tenantId, input.date_preset ?? "last_7d")

  if (name === "get_gtm_containers") {
    const rows = await getGTMConnections(tenantId)
    return (rows as any[]).map(r => ({
      id: r.id, account_name: r.account_name || null, container_name: r.container_name || null,
      public_id: r.public_id, is_active: r.is_active,
    }))
  }
  if (name === "get_gtm_triggers") return getGTMTriggers(tenantId)
  if (name === "create_gtm_trigger") return createGTMTrigger(tenantId, {
    name: input.name, type: input.type, eventName: input.event_name, urlContains: input.url_contains,
  })
  if (name === "get_gtm_tags") return getGTMTags(tenantId)
  if (name === "create_gtm_tag") return createGTMTag(tenantId, {
    name: input.name, kind: input.kind, triggerIds: input.trigger_ids ?? [],
    conversionId: input.conversion_id, conversionLabel: input.conversion_label, conversionValue: input.conversion_value,
    measurementId: input.measurement_id, eventName: input.event_name, html: input.html,
  })
  if (name === "publish_gtm_workspace") return publishGTMWorkspace(tenantId, input.version_name)

  throw new Error(`Ferramenta desconhecida: ${name}`)
}

async function logAction(tenantId: string, action: string, params: any, result: any, status: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from("agent_logs").insert({ tenant_id: tenantId, action, params, result, status, justification: "" })
  if (error) console.error(`[agent] logAction failed tenant=${tenantId} action=${action}:`, error.message)
}

export const ALLOWED_MODELS = ["claude-haiku-4-5-20251001", "claude-sonnet-4-6", "claude-opus-4-7"]

export async function runAgent(
  tenantId: string,
  message: string,
  tenantConfig: Record<string, any>,
  modelId?: string,
  history?: { role: string; content: string }[],
  adAccountId?: string,
  onChunk?: (chunk: AgentChunk) => void,
  connectionId?: string
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

  // Trava de código para a regra "nunca responda de memória": regra em prompt sozinha já
  // falhou em produção (o modelo respondeu com dado de horas atrás, sem chamar ferramenta,
  // pra uma pergunta como "temos campanha ativa?"). Se a pergunta do usuário bate nesses
  // gatilhos e o modelo tenta encerrar sem ter chamado NENHUMA ferramenta neste turno,
  // o código força uma nova tentativa em vez de aceitar a resposta — uma vez só, pra não
  // criar loop infinito se o modelo insistir.
  const VERIFICATION_TRIGGERS = [
    "campanh", "conta", "ativ", "status", "métric", "metrica", "orçamento", "orcamento", "budget",
    "palavra-chave", "palavra chave", "keyword", "grupo de anúncio", "grupo de anuncio",
    "gasto", "resultado", "desempenho", "conversõ", "converso", "roas", "cpl", "cpa", "ctr",
    "gtm", "tag", "container", "gatilho", "ga4", "analytics", "propriedade", "pixel",
  ]
  const needsVerification = VERIFICATION_TRIGGERS.some(k => message.toLowerCase().includes(k))
  let correctionAttempted = false

  const supabase = createServiceClient()
  const period   = new Date().toISOString().slice(0, 7) // YYYY-MM

  async function trackUsage(usage: { input_tokens: number; output_tokens: number }) {
    supabase.rpc("increment_api_usage", {
      p_tenant_id:     tenantId,
      p_period:        period,
      p_input_tokens:  usage.input_tokens,
      p_output_tokens: usage.output_tokens,
    }).then(
      () => {},
      (e: any) => console.error(`[agent] trackUsage failed tenant=${tenantId}:`, e?.message ?? e)
    )
  }

  return runWithMetaConnection(connectionId, async () => {
  while (iterations < MAX_ITERATIONS) {
    iterations++
    const stream = client.messages.stream({
      model, max_tokens: 8192,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      tools: TOOLS_CACHED,
      messages,
    })

    stream.on("text", (text) => {
      onChunk?.({ type: "text", delta: text })
    })

    const response = await stream.finalMessage()
    messages.push({ role: "assistant", content: response.content })
    trackUsage(response.usage)

    if (response.stop_reason === "end_turn") {
      if (needsVerification && toolsUsed.length === 0 && !correctionAttempted) {
        correctionAttempted = true
        messages.push({
          role: "user",
          content: "Você respondeu sem chamar nenhuma ferramenta, mas a pergunta é sobre conta/campanha/status/métrica — dado que pode ter mudado. Chame a ferramenta correspondente agora e responda só com o resultado dela, não com o que você disse antes.",
        })
        continue
      }
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
          // Awaited (not fire-and-forget): the dedupe guard above reads this same
          // table, so a pending write here could let a rapid duplicate slip through.
          await logAction(tenantId, block.name, block.input, result, "success")
          onChunk?.({ type: "tool_done", name: block.name })
          if (WRITE_TOOLS.has(block.name)) {
            actionsTaken.push({ tool: block.name, input: block.input, result })
            onChunk?.({ type: "action", tool: block.name, input: block.input as any, result })
          }
          results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) })
        } catch (e: any) {
          await logAction(tenantId, block.name, block.input, { error: e.message }, "failed")
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
  })
}
