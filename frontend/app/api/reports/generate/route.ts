import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"
import { getCampaigns, getInsights } from "@/lib/server/meta-ads"
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
## ANÁLISE DE GARGALOS
Calcule a taxa de conversão entre cada etapa do funil: Impressões → Alcance → Cliques → {{RESULT_LABEL}}. Para cada campanha, identifique a etapa com maior queda percentual e nomeie o gargalo de forma específica com o número exato que o justifica. Exemplos: "CTR de 0.3% na campanha X indica criativo fraco", "4.200 cliques mas 0 {{RESULT_LABEL_LOWER}} na campanha Y indica problema na landing page (taxa: 0%)".`,

  criativo: `
## ANÁLISE DE CRIATIVO
Para cada campanha, analise CTR e Frequência. Frequência > 3 = potencial saturação de audiência. CTR < 0.8% = criativo não engaja o público. Aponte a campanha com melhor CTR e explique por que com base nos dados. Recomende ação concreta: pausar criativo saturado, criar variação, teste A/B com nova abordagem visual ou de formato.`,

  copy: `
## ANÁLISE DE COPY
Identifique campanhas com CTR alto mas baixo volume de {{RESULT_LABEL_LOWER}} — copy atraente mas promessa desalinhada com a landing page ou com o público. O oposto (CTR baixo, boa taxa de conversão) = copy muito específica, alcançando só quem já conhece a marca. Recomende ajuste de mensagem com base nesses padrões, com texto de exemplo quando possível.`,

  publico: `
## ANÁLISE DE PÚBLICO
Compare o {{KPI_PRINCIPAL}} entre as campanhas ativas — variações > 50% indicam que públicos diferentes estão respondendo de formas muito distintas. A campanha com melhor KPI tem o público mais qualificado: recomende criar Lookalike baseado nessa audiência. CPM alto (> R$30) indica sobreposição de público ou mercado saturado — aponte qual campanha está com CPM mais alto e o motivo provável.`,

  budget: `
## ANÁLISE DE BUDGET
Calcule para cada campanha: % do gasto total consumido vs % de {{RESULT_LABEL_LOWER}} entregue. Monte uma tabela comparativa. Identifique "sorvedouras de budget": campanhas que consomem > 30% do investimento mas entregam < 10% dos resultados. Recomende redistribuição com valores específicos em reais — quanto tirar de qual campanha e quanto alocar para qual.`,
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

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  try {
    const body = await req.json().catch(() => ({}))
    const skills: string[]  = Array.isArray(body.skills) && body.skills.length > 0 ? body.skills : ["gargalos"]
    const objective: string = typeof body.objective === "string" && body.objective ? body.objective : "all"

    const supabase = createServiceClient()
    const [configResult, campaigns, accountInsights] = await Promise.all([
      supabase.from("agent_configs").select("*").eq("tenant_id", tenant.tenant_id).single(),
      getCampaigns(tenant.tenant_id, "last_30d"),
      getInsights(tenant.tenant_id, "last_30d").catch(() => ({})),
    ])

    const allActive = campaigns.filter((c: any) => c.status === "ACTIVE")
    const active    = objective === "all"
      ? allActive
      : allActive.filter((c: any) => c.objective === objective)

    const now       = new Date()
    const period    = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
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

    const skillSections = skills
      .map(s => (SKILL_SECTIONS[s] ?? "")
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

    const prompt = `Você é um especialista em Meta Ads. Analise os dados abaixo e gere um relatório executivo completo em português. Use markdown com ## para seções. Use tabelas markdown para comparar campanhas. Seja direto, objetivo e baseie TODA afirmação em números dos dados fornecidos — zero achismo.

CONFIGURAÇÕES DO CLIENTE:
${configStr}

FOCO DESTA ANÁLISE: ${objLabel}
- KPI principal: ${objConfig.primaryKpi}
- Critério de ranking: ${objConfig.rankingMetric}
- Alerta crítico a verificar: ${objConfig.alertCondition}
- Referências de performance: ${objConfig.goodRange}

RESUMO DA CONTA (últimos 30 dias):
${accountSummary}

CAMPANHAS ANALISADAS (${campaignCount} — pausadas e arquivadas ignoradas):
${campaignRows}

ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:

## RESUMO EXECUTIVO
3-5 linhas: total investido, principal resultado obtido em ${resultLabel.toLowerCase()}, e o problema crítico mais urgente identificado nos dados.

## RANKING DE CAMPANHAS
Use uma tabela markdown com as colunas: ${rankingColumns}
Status: 🟢 Escalar | 🟡 Otimizar | 🔴 Pausar — baseado no ${kpiPrincipal}.
${skillSections}

## RECOMENDAÇÕES PRIORITÁRIAS
Máximo 5 ações ordenadas por impacto esperado. Cada ação deve ser específica com números: "Pausar campanha X — CPL R$63 é 4× o teto de R$15", não "otimize suas campanhas".

## PRÓXIMOS 7 DIAS
Lista numerada e ordenada: o que fazer primeiro, segundo, terceiro.`

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
