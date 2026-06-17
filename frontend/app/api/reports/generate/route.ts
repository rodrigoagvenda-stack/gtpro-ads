import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"
import { getCampaigns, getInsights, getAds } from "@/lib/server/meta-ads"
import { getAnthropicKey } from "@/lib/server/platform"
import Anthropic from "@anthropic-ai/sdk"

// ─── Objective config ─────────────────────────────────────────────────────────

const OBJECTIVE_CONFIG: Record<string, {
  label: string
  primaryKpi: string
  rankingMetric: string
  alertCondition: string
  goodRange: string
}> = {
  all: {
    label: "Todas as campanhas",
    primaryKpi: "KPI principal do objetivo de cada campanha — CPL (Leads), ROAS (Vendas), Custo/Conversa (WhatsApp), CPE (Engajamento), CPC (Tráfego), CPM (Reconhecimento)",
    rankingMetric: "compare cada campanha pelo KPI principal do SEU objetivo, não misture métricas entre objetivos diferentes",
    alertCondition: "campanhas onde o KPI principal está ausente: 0 leads em campanha de leads, 0 compras em vendas, 0 conversas em WhatsApp",
    goodRange: "varia por objetivo — avalie cada campanha pelo seu próprio KPI",
  },
  OUTCOME_LEADS: {
    label: "Geração de Leads",
    primaryKpi: "CPL (Custo por Lead), volume total de leads e taxa de conversão clique→lead",
    rankingMetric: "menor CPL = melhor. Campanhas com 0 leads = crítico independente do gasto",
    alertCondition: "campanhas com cliques mas 0 leads indicam problema na landing page ou formulário — não é problema de criativo",
    goodRange: "CTR saudável: > 1%. Taxa clique→lead saudável: > 5%. CPL deve estar abaixo do máximo configurado",
  },
  OUTCOME_TRAFFIC: {
    label: "Tráfego para Site",
    primaryKpi: "CPC (Custo por Clique), CTR (Taxa de Cliques), cliques outbound e cliques únicos",
    rankingMetric: "menor CPC com maior CTR = melhor. CTR < 0.8% = criativo fraco para tráfego",
    alertCondition: "CTR < 0.5% = criativo não ressona com o público. CPC muito acima do benchmark do nicho",
    goodRange: "CTR ideal: 1-3%. Frequência > 4 = saturação de público. CPC varia por nicho e concorrência",
  },
  OUTCOME_ENGAGEMENT: {
    label: "Engajamento",
    primaryKpi: "engajamentos totais, CPE (Custo por Engajamento), engajamentos no post, na página e novos seguidores",
    rankingMetric: "menor CPE com maior volume de engajamentos = melhor",
    alertCondition: "campanhas com impressões altas mas 0 engajamentos = criativo irrelevante para o público segmentado",
    goodRange: "CPE saudável: < R$0,50. Frequência ideal 2-5. Engajamento inclui: curtidas, comentários, compartilhamentos, cliques",
  },
  OUTCOME_AWARENESS: {
    label: "Reconhecimento de Marca",
    primaryKpi: "alcance único, CPM (Custo por Mil Impressões) e frequência de exposição",
    rankingMetric: "maior alcance com menor CPM = melhor. Frequência ideal: 2-5 para awareness",
    alertCondition: "frequência > 7 = público saturado, necessário expandir audiência ou criar exclusão. CPM > R$40 = mercado saturado ou público muito pequeno",
    goodRange: "CPM saudável: R$10-R$30. Frequência ideal: 2-5. Alcance deve crescer a cada período",
  },
  OUTCOME_SALES: {
    label: "Vendas (E-commerce)",
    primaryKpi: "ROAS (Retorno sobre gasto), CPP (Custo por Compra), número de compras e receita estimada",
    rankingMetric: "maior ROAS e menor CPP = melhor. ROAS abaixo do mínimo configurado = candidato a pausa imediata",
    alertCondition: "campanhas com cliques mas 0 compras = problema na página de produto, checkout ou pixel de rastreamento mal configurado",
    goodRange: "ROAS mínimo definido pelo cliente. Taxa clique→compra saudável: > 1%. CPP varia muito por produto",
  },
  OUTCOME_MESSAGES: {
    label: "Mensagens / WhatsApp",
    primaryKpi: "conversas iniciadas no WhatsApp, custo por conversa e taxa de clique→conversa",
    rankingMetric: "menor custo por conversa com maior volume = melhor",
    alertCondition: "campanhas com cliques mas 0 conversas = problema no link do WhatsApp, número incorreto ou horário de atendimento incompatível com a audiência",
    goodRange: "custo por conversa varia por nicho. CTR saudável: > 1%. Taxa clique→conversa saudável: > 10%",
  },
}

// ─── Result labels ─────────────────────────────────────────────────────────────

const RESULT_LABEL: Record<string, string> = {
  OUTCOME_LEADS:      "Leads",
  OUTCOME_TRAFFIC:    "Cliques",
  OUTCOME_ENGAGEMENT: "Engajamentos",
  OUTCOME_AWARENESS:  "Pessoas Alcançadas",
  OUTCOME_SALES:      "Compras",
  OUTCOME_MESSAGES:   "Conversas",
  all:                "Resultados (Leads/Compras/Conversas/Engajamentos)",
}

const KPI_PRINCIPAL: Record<string, string> = {
  OUTCOME_LEADS:      "CPL (Custo por Lead)",
  OUTCOME_TRAFFIC:    "CPC (Custo por Clique)",
  OUTCOME_ENGAGEMENT: "CPE (Custo por Engajamento)",
  OUTCOME_AWARENESS:  "CPM (Custo por Mil Impressões)",
  OUTCOME_SALES:      "ROAS e CPP (Custo por Compra)",
  OUTCOME_MESSAGES:   "Custo por Conversa",
  all:                "KPI principal de cada objetivo",
}

// ─── Skill sections ────────────────────────────────────────────────────────────

const SKILL_SECTIONS: Record<string, string> = {
  gargalos: `
## Análise de Gargalos

Tabela obrigatória: Campanha | Impressões | Alcance | Cliques | {{RESULT_LABEL}} | Etapa com maior perda | % de queda | Diagnóstico

Para cada campanha calcule o funil completo: Impressões → Alcance (perda por frequência/sobreposição) → Cliques (perda por criativo/copy) → {{RESULT_LABEL}} (perda por landing page/oferta). Destaque a etapa com MAIOR queda percentual.
Depois: 2-3 bullets com ações concretas para cada gargalo identificado.`,

  criativo: `
## Análise de Criativo

Tabela obrigatória: Campanha | CTR | Frequência | Impressões | CPM | Diagnóstico | Ação recomendada

Regras de diagnóstico:
- CTR < 0.8% = criativo não ressoa → testar novo hook/formato
- CTR > 2% = criativo forte → escalar budget
- Frequência > 3 = saturação → excluir quem já viu 3x ou criar novos criativos
- Frequência > 5 = urgente renovar criativos
- CPM alto + CTR baixo = público errado, não criativo ruim

Depois: lista de 3 ações prioritárias de criativo ordenadas por impacto.`,

  copy: `
## Análise de Copy

Para cada campanha analise a relação CTR vs taxa de conversão:
- CTR alto + poucos {{RESULT_LABEL_LOWER}} = promessa do anúncio não bate com a landing page
- CTR baixo + boa conversão = copy muito específica, público qualificado mas limitado
- CTR baixo + zero {{RESULT_LABEL_LOWER}} = problema na copy E na oferta

Tabela: Campanha | CTR | {{RESULT_LABEL}} | Taxa clique→resultado | Diagnóstico | Ajuste recomendado

Feche com 2 sugestões concretas de headline/copy baseadas nos dados.`,

  publico: `
## Análise de Público

Tabela obrigatória: Campanha | CPM | Frequência | Alcance | {{KPI_PRINCIPAL}} | Custo por {{RESULT_LABEL}} | Status do público

Regras de análise:
- CPM > R$30 = mercado saturado ou público muito pequeno → expandir audiência ou adicionar exclusões
- CPM < R$15 = público amplo, potencial de escala
- Frequência > 4 = público esgotado → criar exclusão de quem já converteu + LAL
- Frequência < 1.5 com gasto alto = público grande mas sub-alcançado → verificar segmentação
- Se variação de CPM > 50% entre campanhas = públicos com qualidades muito distintas → pausar o mais caro e escalar o mais barato
- Menor custo/resultado = público mais qualificado → criar Lookalike 1%, 2% e 3% baseado nesse público

Conclua com recomendação clara: qual público escalar, qual pausar e por quê.`,

  budget: `
## Análise de Budget

Tabela obrigatória: Campanha | Gasto (R$) | % do gasto total | {{RESULT_LABEL}} | % dos resultados | ROI relativo | Diagnóstico

Calcule ROI relativo = (% resultados) / (% gasto). ROI > 1 = eficiente. ROI < 0.5 = sorvedoura.
- Sorvedoura (> 30% gasto, < 10% resultados): corte imediato ou teste com 50% menos budget
- Subcapitalizada (< 10% gasto, > 20% resultados): aumentar budget 30-50%
- Equilibrada: manter e monitorar

Feche com redistribuição concreta: ex. "Mover R$X da [campanha A] para [campanha B] = ganho estimado de Y {{RESULT_LABEL_LOWER}}".`,
}

// ─── Build campaign row with objective-specific metrics ───────────────────────

function buildCampaignRow(c: any, objective: string): string {
  const m   = c.metrics ?? {}
  const n   = (v: any, d = 2) => Number(v ?? 0).toFixed(d)
  const loc = (v: any) => Number(v ?? 0).toLocaleString("pt-BR")

  const base: (string | null)[] = [
    `**${c.name}** (${c.objective?.replace("OUTCOME_", "") ?? "?"})`,
    `Gasto: R$${n(m.spend)}`,
    `Impressões: ${loc(m.impressions)}`,
    `Alcance: ${loc(m.reach)}`,
    `Frequência: ${n(m.frequency, 1)}`,
    `CPM: R$${n(m.cpm)}`,
  ]

  const extra: (string | null)[] = []

  switch (objective) {
    case "OUTCOME_LEADS":
      extra.push(
        `Cliques: ${loc(m.clicks)}`,
        `CTR: ${n(m.ctr)}%`,
        `CPC: R$${n(m.cpc)}`,
        m.unique_clicks != null ? `Cliques Únicos: ${loc(m.unique_clicks)}` : null,
        `Leads: ${m.leads ?? 0}`,
        `CPL: ${m.cpl != null ? `R$${n(m.cpl)}` : (m.leads && Number(m.leads) > 0 ? `R$${(Number(m.spend) / Number(m.leads)).toFixed(2)}` : "—")}`,
        `Taxa Clique→Lead: ${m.clicks && Number(m.clicks) > 0 ? `${(Number(m.leads ?? 0) / Number(m.clicks) * 100).toFixed(1)}%` : "0%"}`,
      )
      break

    case "OUTCOME_TRAFFIC":
      extra.push(
        `Cliques: ${loc(m.clicks)}`,
        `CTR: ${n(m.ctr)}%`,
        `CPC: R$${n(m.cpc)}`,
        m.unique_clicks   != null ? `Cliques Únicos: ${loc(m.unique_clicks)}` : null,
        m.outbound_clicks != null ? `Cliques Outbound: ${loc(m.outbound_clicks)}` : null,
        m.unique_clicks && m.clicks
          ? `Taxa Cliques Únicos/Total: ${(Number(m.unique_clicks) / Number(m.clicks) * 100).toFixed(1)}%`
          : null,
      )
      break

    case "OUTCOME_ENGAGEMENT":
      extra.push(
        `Cliques: ${loc(m.clicks)}`,
        `CTR: ${n(m.ctr)}%`,
        `Engajamentos: ${loc(m.engagements ?? 0)}`,
        `CPE: ${m.engagements && Number(m.engagements) > 0
          ? `R$${(Number(m.spend) / Number(m.engagements)).toFixed(2)}`
          : "—"}`,
        m.post_engagement != null ? `Eng. no Post: ${loc(m.post_engagement)}` : null,
        m.page_engagement != null ? `Eng. na Página: ${loc(m.page_engagement)}` : null,
        m.follows         != null ? `Novos Seguidores: ${m.follows}` : null,
      )
      break

    case "OUTCOME_AWARENESS":
      // Awareness is reach/frequency/CPM focused — no conversion metrics needed
      extra.push(
        m.unique_clicks != null ? `Cliques: ${loc(m.unique_clicks)}` : null,
      )
      break

    case "OUTCOME_SALES":
      extra.push(
        `Cliques: ${loc(m.clicks)}`,
        `CTR: ${n(m.ctr)}%`,
        `CPC: R$${n(m.cpc)}`,
        m.unique_clicks != null ? `Cliques Únicos: ${loc(m.unique_clicks)}` : null,
        `ROAS: ${m.roas != null ? `${n(m.roas)}x` : "0x"}`,
        `Compras: ${m.website_purchases ?? 0}`,
        `CPP (Custo/Compra): ${
          m.cpp != null ? `R$${n(m.cpp)}`
          : (m.website_purchases && Number(m.website_purchases) > 0)
            ? `R$${(Number(m.spend) / Number(m.website_purchases)).toFixed(2)}`
            : "—"}`,
        m.roas != null ? `Receita Est.: R$${(Number(m.spend) * Number(m.roas)).toFixed(2)}` : null,
        `Taxa Clique→Compra: ${m.clicks && Number(m.clicks) > 0
          ? `${(Number(m.website_purchases ?? 0) / Number(m.clicks) * 100).toFixed(2)}%`
          : "0%"}`,
      )
      break

    case "OUTCOME_MESSAGES":
      extra.push(
        `Cliques: ${loc(m.clicks)}`,
        `CTR: ${n(m.ctr)}%`,
        `CPC: R$${n(m.cpc)}`,
        `Conversas WA: ${m.conversations ?? 0}`,
        `Custo/Conversa: ${m.conversations && Number(m.conversations) > 0
          ? `R$${(Number(m.spend) / Number(m.conversations)).toFixed(2)}`
          : "—"}`,
        `Taxa Clique→Conversa: ${m.clicks && Number(m.clicks) > 0
          ? `${(Number(m.conversations ?? 0) / Number(m.clicks) * 100).toFixed(1)}%`
          : "0%"}`,
      )
      break

    default: // "all" — show everything available
      extra.push(
        `Cliques: ${loc(m.clicks)}`,
        `CTR: ${n(m.ctr)}%`,
        `CPC: R$${n(m.cpc)}`,
        m.leads             != null ? `Leads: ${m.leads}` : null,
        m.cpl               != null ? `CPL: R$${n(m.cpl)}` : null,
        m.roas              != null ? `ROAS: ${n(m.roas)}x` : null,
        m.conversations     != null ? `Conversas WA: ${m.conversations}` : null,
        m.engagements       != null ? `Engajamentos: ${loc(m.engagements)}` : null,
        m.website_purchases != null ? `Compras: ${m.website_purchases}` : null,
        m.cpp               != null ? `CPP: R$${n(m.cpp)}` : null,
        m.unique_clicks     != null ? `Cliques Únicos: ${loc(m.unique_clicks)}` : null,
        m.outbound_clicks   != null ? `Cliques Outbound: ${loc(m.outbound_clicks)}` : null,
        m.post_engagement   != null ? `Eng. no Post: ${loc(m.post_engagement)}` : null,
        m.follows           != null ? `Novos Seguidores: ${m.follows}` : null,
      )
  }

  return [...base, ...extra].filter(Boolean).join(" | ")
}

// ─── Build individual ad (creative) row ─────────────────────────────────────

function buildAdRow(ad: any, campaignName: string, objective: string): string {
  const ins     = ad.insights?.data?.[0] ?? {}
  const actions = ins.actions ?? []
  const spend   = Number(ins.spend ?? 0)
  const n   = (v: any, d = 2) => Number(v ?? 0).toFixed(d)
  const loc = (v: any) => Number(v ?? 0).toLocaleString("pt-BR")

  const pick = (...types: string[]) => {
    const a = actions.find((x: any) => types.includes(x.action_type) && Number(x.value) > 0)
    return a ? Number(a.value) : null
  }

  const leads         = pick("lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead")
  const conversations = pick("onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.messaging_first_reply")
  const purchases     = pick("omni_purchase", "offsite_conversion.fb_pixel_purchase")
  const engagements   = pick("post_engagement", "page_engagement")

  const creative    = ad.creative ?? {}
  const copyText    = (creative.body || creative.title || "").slice(0, 80)
  const copyPreview = copyText ? ` | Copy: "${copyText}${copyText.length === 80 ? "..." : ""}"` : ""

  const v25  = ins.video_p25_watched_actions?.[0]?.value
  const v50  = ins.video_p50_watched_actions?.[0]?.value
  const v75  = ins.video_p75_watched_actions?.[0]?.value
  const v100 = ins.video_p100_watched_actions?.[0]?.value
  const videoStr = v25 != null
    ? ` | Vídeo: 25%=${v25} 50%=${v50 ?? "—"} 75%=${v75 ?? "—"} 100%=${v100 ?? "—"}`
    : ""

  const parts: (string | null)[] = [
    `**Criativo: ${ad.name}** | Campanha: ${campaignName}${copyPreview}`,
    `Status: ${ad.status}`,
    `Gasto: R$${n(spend)}`,
    `Impressões: ${loc(ins.impressions)}`,
    `CTR: ${n(ins.ctr)}%`,
    `CPC: R$${n(ins.cpc)}`,
    `CPM: R$${n(ins.cpm)}`,
    `Frequência: ${n(ins.frequency, 1)}`,
    `Cliques: ${loc(ins.clicks)}`,
    leads         != null ? `Leads: ${leads} | CPL: ${leads > 0 ? `R$${(spend / leads).toFixed(2)}` : "—"}` : null,
    conversations != null ? `Conversas: ${conversations} | Custo/Conversa: ${conversations > 0 ? `R$${(spend / conversations).toFixed(2)}` : "—"}` : null,
    purchases     != null ? `Compras: ${purchases} | CPP: ${purchases > 0 ? `R$${(spend / purchases).toFixed(2)}` : "—"}` : null,
    engagements   != null ? `Engajamentos: ${loc(engagements)}` : null,
  ]

  return parts.filter(Boolean).join(" | ") + videoStr
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  try {
    const body = await req.json().catch(() => ({}))
    const skills: string[]      = Array.isArray(body.skills) && body.skills.length > 0 ? body.skills : ["gargalos"]
    const objective: string     = typeof body.objective === "string" && body.objective ? body.objective : "all"
    const datePreset: string    = typeof body.datePreset === "string" && body.datePreset ? body.datePreset : "last_30d"
    const connectionId: string | undefined = typeof body.connectionId === "string" && body.connectionId ? body.connectionId : undefined
    const campaignIds: string[] = Array.isArray(body.campaignIds) ? body.campaignIds : []
    const since: string | undefined = typeof body.since === "string" && body.since ? body.since : undefined
    const until: string | undefined = typeof body.until === "string" && body.until ? body.until : undefined
    const isCustomDate = !!(since && until)

    const DATE_LABELS: Record<string, string> = {
      last_7d: "últimos 7 dias", last_14d: "últimos 14 dias", last_30d: "últimos 30 dias",
      last_90d: "últimos 90 dias", this_month: "este mês", last_month: "mês passado",
    }

    const supabase = createServiceClient()
    const [configResult, campaigns, accountInsights] = await Promise.all([
      supabase.from("agent_configs").select("*").eq("tenant_id", tenant.tenant_id).single(),
      getCampaigns(tenant.tenant_id, datePreset, connectionId, since, until),
      getInsights(tenant.tenant_id, datePreset, since, until).catch(() => ({})),
    ])

    let allActive = campaigns.filter((c: any) => c.status === "ACTIVE")
    if (campaignIds.length > 0) allActive = allActive.filter((c: any) => campaignIds.includes(c.id))
    const active = objective === "all"
      ? allActive
      : allActive.filter((c: any) => c.objective === objective)

    // Fetch individual ads (creatives) for each active campaign in parallel
    const adResults = await Promise.allSettled(
      active.slice(0, 10).map((c: any) =>
        getAds(tenant.tenant_id, c.id, datePreset, since, until)
          .then(ads => ({ campaignId: c.id, campaignName: c.name, ads }))
      )
    )
    const allAdGroups = adResults.filter(r => r.status === "fulfilled").map((r: any) => r.value)
    const allAds      = allAdGroups.flatMap(g => g.ads.map((ad: any) => ({ ...ad, campaignName: g.campaignName })))
    const hasMultiCreatives = allAdGroups.some(g => g.ads.length > 1)
    const adRows = allAds.length > 0
      ? allAds.map((ad: any) => buildAdRow(ad, ad.campaignName, objective)).join("\n")
      : ""

    const now    = new Date()
    const presetDays: Record<string, number> = { last_7d: 7, last_14d: 14, last_30d: 30, last_90d: 90, this_month: 30, last_month: 30 }
    const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" })
    let days: number
    let periodLabel: string
    let period: string
    if (isCustomDate) {
      const sinceD = new Date(since!)
      const untilD = new Date(until!)
      days = Math.max(1, Math.round((untilD.getTime() - sinceD.getTime()) / 86400_000))
      periodLabel = `${sinceD.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })} a ${untilD.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}`
      period = `${periodLabel} — personalizado`
    } else {
      days = presetDays[datePreset] ?? 30
      const startD = new Date(now.getTime() - days * 86400_000)
      periodLabel = `${fmtDate(startD)} a ${fmtDate(now)}`
      period = `${DATE_LABELS[datePreset] ?? datePreset} — ${now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`
    }
    const objConfig = OBJECTIVE_CONFIG[objective] ?? OBJECTIVE_CONFIG.all
    const objLabel  = objConfig.label

    if (active.length === 0) {
      const msg = objective === "all"
        ? "Nenhuma campanha com status ACTIVE foi encontrada no período. Ative pelo menos uma campanha para gerar análise."
        : `Nenhuma campanha ativa com objetivo "${objLabel}" foi encontrada. Verifique se existem campanhas desse tipo ativas, ou escolha "Todas as campanhas".`
      const { data: report } = await supabase.from("reports").insert({
        tenant_id: tenant.tenant_id,
        title: `Relatório ${objLabel} — ${period}`,
        period,
        summary: `## Sem campanhas ativas\n\n${msg}`,
        generated_by: "agent",
      }).select().single()
      return Response.json(report)
    }

    const campaignRows  = active.map(c => buildCampaignRow(c, objective)).join("\n")
    const resultLabel   = RESULT_LABEL[objective]   ?? "Resultados"
    const kpiPrincipal  = KPI_PRINCIPAL[objective]  ?? "KPI principal"

    const acc: any = accountInsights
    const accountSummary = `Conta (30 dias): Gasto R$${Number(acc.spend ?? 0).toFixed(2)} | Impressões ${Number(acc.impressions ?? 0).toLocaleString("pt-BR")} | Alcance ${Number(acc.reach ?? 0).toLocaleString("pt-BR")} | Cliques ${Number(acc.clicks ?? 0).toLocaleString("pt-BR")} | CTR ${Number(acc.ctr ?? 0).toFixed(2)}%`

    const config    = configResult.data ?? {}
    const configStr = `Objetivo: ${config.objetivo_principal ?? "não definido"} | ROAS mín: ${config.roas_minimo ?? "—"} | CPL máx: R$${config.cpl_maximo ?? "—"} | Budget mensal: R$${config.budget_mensal ?? "—"}`

    // Dynamic skill sections — criativo/copy use per-ad data when available
    const criativoSection = hasMultiCreatives ? `
## Análise de Criativo

USE OS DADOS DE "CRIATIVOS — dados individuais por anúncio" fornecidos abaixo. Analise CADA CRIATIVO SEPARADAMENTE com seu próprio nome real.

Tabela obrigatória (uma linha por criativo): Criativo | Campanha | Gasto (R$) | Impressões | CTR | CPM | Frequência | ${resultLabel} | Custo/${resultLabel} | Diagnóstico

Compare os criativos entre si:
- Qual tem melhor CTR? Qual tem menor custo por resultado? Qual tem melhor eficiência de gasto?
- Recomende qual escalar (mais eficiente) e qual pausar ou recriar (pior desempenho)
- Se houver texto de copy disponível nos dados (campo Copy:), cite trechos específicos no diagnóstico
- Para vídeo: analise retenção (25%/50%/75%/100%) — queda brusca antes de 25% = hook fraco; boa retenção até 75% = mensagem relevante

Regras de diagnóstico:
- CTR < 0.8% = hook fraco → reformular os primeiros 3s
- CTR > 2% = criativo forte → escalar budget
- Frequência > 3 = saturação → novo criativo urgente
- CPM alto + CTR baixo = problema no público, não no criativo

3 ações prioritárias por impacto, com o nome exato do criativo em cada ação.
` : `
## Análise de Criativo

Tabela obrigatória: Campanha | CTR | Frequência | Impressões | CPM | Diagnóstico | Ação recomendada

Regras de diagnóstico:
- CTR < 0.8% = hook fraco → reformular os primeiros 3s do vídeo / headline da imagem
- CTR > 2% = criativo forte → escalar budget
- Frequência > 3 = saturação → criar variações urgente
- CPM alto + CTR baixo = problema no público, não no criativo

3 ações prioritárias por impacto.
`

    const copySection = hasMultiCreatives ? `
## Análise de Copy

USE OS DADOS DE "CRIATIVOS — dados individuais por anúncio". Analise o texto de cada criativo separadamente (campo Copy:).

Para cada criativo com copy disponível:
- CTR alto + poucos ${resultLabel.toLowerCase()} = promessa do anúncio não bate com a página/formulário
- CTR baixo + boa conversão = copy muito específica, público qualificado mas pequeno
- CTR baixo + zero ${resultLabel.toLowerCase()} = problema na copy E na oferta

Tabela: Criativo | Copy (trecho) | CTR | ${resultLabel} | Taxa clique→resultado | Diagnóstico | Ajuste recomendado

2 sugestões concretas de headline ou chamada para ação baseadas nos dados e textos reais dos criativos.
` : SKILL_SECTIONS.copy

    const dynamicSections: Record<string, string> = {
      ...SKILL_SECTIONS,
      criativo: criativoSection,
      copy:     copySection,
    }

    const skillSections = skills
      .map(s => (dynamicSections[s] ?? "")
        .replace(/\{\{RESULT_LABEL\}\}/g,       resultLabel)
        .replace(/\{\{RESULT_LABEL_LOWER\}\}/g, resultLabel.toLowerCase())
        .replace(/\{\{KPI_PRINCIPAL\}\}/g,      kpiPrincipal)
      )
      .filter(Boolean)
      .join("\n")

    const campaignCount = objective === "all"
      ? `${active.length} campanha(s) ativa(s) de todos os objetivos`
      : `${active.length} campanha(s) ativa(s) com objetivo "${objLabel}" (de ${allActive.length} ativas no total)`

    const rankingColumns = {
      OUTCOME_LEADS:      "Campanha | Gasto | Leads | CPL | Taxa Clique→Lead | Status | Justificativa",
      OUTCOME_TRAFFIC:    "Campanha | Gasto | Cliques | CTR | CPC | Cliques Únicos | Status | Justificativa",
      OUTCOME_ENGAGEMENT: "Campanha | Gasto | Engajamentos | CPE | CTR | Seguidores | Status | Justificativa",
      OUTCOME_AWARENESS:  "Campanha | Gasto | Alcance | CPM | Frequência | Status | Justificativa",
      OUTCOME_SALES:      "Campanha | Gasto | Compras | ROAS | CPP | Taxa Clique→Compra | Status | Justificativa",
      OUTCOME_MESSAGES:   "Campanha | Gasto | Conversas WA | Custo/Conversa | CTR | Taxa Clique→Conversa | Status | Justificativa",
      all:                "Campanha | Objetivo | Gasto | KPI Principal | Valor KPI | Status | Justificativa",
    }[objective] ?? "Campanha | Gasto | KPI Principal | Status | Justificativa"

    // Pre-compute aggregates
    const totalSpend       = active.reduce((a: number, c: any) => a + Number(c.metrics?.spend ?? 0), 0)
    const totalImpressions = active.reduce((a: number, c: any) => a + Number(c.metrics?.impressions ?? 0), 0)
    const totalReach       = active.reduce((a: number, c: any) => a + Number(c.metrics?.reach ?? 0), 0)
    const totalClicks      = active.reduce((a: number, c: any) => a + Number(c.metrics?.clicks ?? 0), 0)
    const totalLeads       = active.reduce((a: number, c: any) => a + Number(c.metrics?.leads ?? 0), 0)
    const totalConversas   = active.reduce((a: number, c: any) => a + Number(c.metrics?.conversations ?? 0), 0)
    const totalCompras     = active.reduce((a: number, c: any) => a + Number(c.metrics?.website_purchases ?? 0), 0)
    const totalEngaj       = active.reduce((a: number, c: any) => a + Number(c.metrics?.engagements ?? 0), 0)
    const totalFollows     = active.reduce((a: number, c: any) => a + Number(c.metrics?.follows ?? 0), 0)
    const bestCpc          = active.reduce((best: number, c: any) => {
      const cpc = Number(c.metrics?.cpc ?? 0)
      return (cpc > 0 && (best === 0 || cpc < best)) ? cpc : best
    }, 0)
    const avgCtr         = totalClicks > 0 && totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0
    const dailySpend     = totalSpend / days
    const dailyReach     = totalReach / days
    const custoSeguidores = totalFollows > 0 ? totalSpend / totalFollows : null

    // Chart data — pre-computed, injected verbatim (AI does not generate this)
    const totalResultado = ({
      OUTCOME_LEADS:      totalLeads,
      OUTCOME_MESSAGES:   totalConversas,
      OUTCOME_SALES:      totalCompras,
      OUTCOME_ENGAGEMENT: totalEngaj,
      OUTCOME_AWARENESS:  totalReach,
      OUTCOME_TRAFFIC:    totalClicks,
    } as Record<string, number>)[objective] ?? (totalLeads + totalConversas + totalCompras)

    const chartJson = JSON.stringify({
      type: "bar",
      items: [
        { label: "Impressões",          value: totalImpressions,              fmt: "" },
        { label: "Cliques/interações",  value: totalClicks,                   fmt: "" },
        { label: resultLabel,           value: totalResultado,                fmt: "" },
        { label: "Investimento (R$)",   value: parseFloat(totalSpend.toFixed(2)), fmt: "R$" },
      ],
    })

    const agencyName    = config.agency_name    ?? config.tenant_name ?? "GTPRO"
    const agencyEmail   = config.agency_email   ?? ""
    const agencyWebsite = config.agency_website ?? ""
    const gestora       = config.gestora        ?? ""
    const gerente       = config.gerente        ?? ""

    const headerLines = [
      gestora ? `**Gestora:** ${gestora}` : "",
      gerente ? `**Gerente:** ${gerente}` : "",
      `**Período:** ${periodLabel}`,
      `**Canais:** Campanhas de divulgação · Instagram · Meta Ads`,
    ].filter(Boolean).join("\n")

    const signatureExtra = [agencyEmail, agencyWebsite].filter(Boolean).join(" · ")
    const signature = signatureExtra
      ? `*Relatório produzido por ${agencyName} · ${signatureExtra}*`
      : `*Relatório produzido por ${agencyName}*`

    const prompt = `Você é especialista em Meta Ads. Gere o relatório COMPLETO abaixo seguindo EXATAMENTE a estrutura fornecida. Use SOMENTE os dados reais fornecidos. Sem introduções, sem explicar o que vai fazer, sem repetir dados entre seções.

DADOS DA CONTA:
Configurações: ${configStr}
Conta (agregado): ${accountSummary}
Objetivo analisado: ${objLabel} | KPI: ${kpiPrincipal}
Número de campanhas ativas: ${campaignCount}

TOTAIS PRÉ-CALCULADOS:
- Impressões: ${totalImpressions.toLocaleString("pt-BR")}
- Alcance: ${totalReach.toLocaleString("pt-BR")}
- Cliques/interações: ${totalClicks.toLocaleString("pt-BR")}
- Leads: ${totalLeads} | Conversas WA: ${totalConversas} | Compras: ${totalCompras} | Engajamentos: ${totalEngaj.toLocaleString("pt-BR")} | Novos seguidores: ${totalFollows}
- Investimento total: R$ ${totalSpend.toFixed(2).replace(".", ",")}
- CPC médio: R$ ${totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2).replace(".", ",") : "—"}
- Melhor CPC: R$ ${bestCpc > 0 ? bestCpc.toFixed(2).replace(".", ",") : "—"}
- CTR médio: ${avgCtr.toFixed(2).replace(".", ",")}%
- Investimento diário médio: R$ ${dailySpend.toFixed(2).replace(".", ",")}
- Pessoas alcançadas por dia: ${Math.round(dailyReach)}${custoSeguidores != null ? `\n- Custo por seguidor: R$ ${custoSeguidores.toFixed(2).replace(".", ",")}` : ""}

CAMPANHAS (dados individuais):
${campaignRows}
${adRows ? `
CRIATIVOS — dados individuais por anúncio (use nas análises de Criativo e Copy):
${adRows}
` : ""}
GERE o relatório com EXATAMENTE esta estrutura — substitua os placeholders pelos dados reais acima:

# Relatório de Performance Digital
## [nome da empresa/cliente baseado no nome da conta]

${headerLines}

---

## 01 · Visão Geral — Principais Resultados

| Indicador | Resultado |
|---|---|
| Pessoas impactadas | +${totalImpressions.toLocaleString("pt-BR")} impressões |
| Cliques e interações | ${totalClicks.toLocaleString("pt-BR")} |
| [Resultado principal: Leads/Conversas/Compras/Seguidores/Engajamentos — use o mais relevante para o objetivo] | [valor correspondente] |
| Investimento total | R$ ${totalSpend.toFixed(2).replace(".", ",")} |
| Custo médio por clique | R$ ${totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2).replace(".", ",") : "—"} |
| Melhor CPC | R$ ${bestCpc > 0 ? bestCpc.toFixed(2).replace(".", ",") : "—"} |
| Custo por [resultado principal] | [calcule com base nos totais] |${custoSeguidores != null ? `\n| Custo por seguidor | R$ ${custoSeguidores.toFixed(2).replace(".", ",")} |` : ""}
| Taxa de interesse nos anúncios (CTR) | ${avgCtr.toFixed(2).replace(".", ",")}% |
| Investimento diário médio | R$ ${dailySpend.toFixed(2).replace(".", ",")} |
| Pessoas alcançadas por dia | ${Math.round(dailyReach)} |

---

## 02 · Análise Visual

### Volume de resultados gerados

Copie EXATAMENTE este bloco abaixo, sem modificar nenhum caractere:
\`\`\`chart
${chartJson}
\`\`\`

### CTR — Taxa de interesse

- **${avgCtr.toFixed(2).replace(".", ",")}%** do público que viu os anúncios interagiu com eles
- ${totalClicks.toLocaleString("pt-BR")} pessoas interagiram · ${(totalImpressions - totalClicks).toLocaleString("pt-BR")} apenas visualizaram

### Eficiência do investimento

> Com apenas **R$${dailySpend.toFixed(2).replace(".", ",")} por dia**, a campanha alcançou **${Math.round(dailyReach)} pessoas por dia** durante ${days} dias.

---

${skillSections}

---

## Próximos Passos

### Curto prazo — Ações imediatas

[3 bullets ESPECÍFICOS com ações desta semana baseadas nas análises acima — cite campanhas pelo nome real, valores reais e o impacto esperado de cada ação]

### Médio prazo — Próxima fase

[3 bullets com ações estratégicas para o próximo mês — escala, novos públicos, testes de criativo]

---

## Conclusão

[1 parágrafo executivo. Mencione em negrito os 4-5 números mais importantes das análises acima. Finalize com direcionamento claro: qual alavanca mover primeiro para transformar os resultados em negócio concreto.]

---

${signature}
*${periodLabel}*`

    const key      = await getAnthropicKey()
    const client   = new Anthropic({ apiKey: key })
    const response = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 8192,
      messages:   [{ role: "user", content: prompt }],
    })

    supabase.rpc("increment_api_usage", {
      p_tenant_id:     tenant.tenant_id,
      p_period:        now.toISOString().slice(0, 7),
      p_input_tokens:  response.usage.input_tokens,
      p_output_tokens: response.usage.output_tokens,
    }).then(() => {})

    const summary = (response.content.find(b => b.type === "text") as any)?.text ?? ""

    const { data: report } = await supabase.from("reports").insert({
      tenant_id:    tenant.tenant_id,
      title:        `Relatório ${objLabel} — ${period}`,
      period,
      summary,
      generated_by: "agent",
    }).select().single()

    return Response.json(report)
  } catch (e: any) {
    console.error("[reports/generate]", e)
    return Response.json({ error: e.message ?? "Erro interno ao gerar relatório" }, { status: 500 })
  }
}
