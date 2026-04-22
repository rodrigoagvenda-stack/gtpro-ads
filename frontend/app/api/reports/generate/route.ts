import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"
import { getCampaigns, getInsights } from "@/lib/server/meta-ads"
import Anthropic from "@anthropic-ai/sdk"

const SKILL_SECTIONS: Record<string, string> = {
  gargalos: `
## ANÁLISE DE GARGALOS
Para cada campanha ativa, calcule a taxa de conversão entre cada etapa do funil (Impressões → Cliques → Leads/Conversões). Identifique a etapa com maior queda percentual e nomeie o gargalo de forma específica. Exemplos: "CTR de 0.3% indica criativo fraco", "Alto volume de cliques mas 0 leads indica página de destino ruim". Toda afirmação deve ter o número que a justifica.`,

  criativo: `
## ANÁLISE DE CRIATIVO
Analise CTR e frequência de cada campanha ativa. Frequência > 3 = saturado. CTR < 0.8% = criativo não engaja. Aponte a campanha com melhor CTR e explique por quê com base nos dados. Recomende ação concreta: pausar criativo saturado, criar teste A/B, etc.`,

  copy: `
## ANÁLISE DE COPY
Identifique campanhas com alto CTR mas baixa taxa de conversão (clique→lead) — isso indica copy atraente mas promessa errada. Ao contrário, baixo CTR mas boa conversão = copy específica demais. Recomende ajuste de mensagem com base nesses padrões.`,

  publico: `
## ANÁLISE DE PÚBLICO
Compare CPL entre campanhas ativas — variações > 50% indicam públicos muito diferentes respondendo diferente. A campanha com menor CPL tem o público mais qualificado. Recomende criar lookalike desse público. Aponte se CPM alto (> R$30) indica sobreposição de público ou mercado saturado.`,

  budget: `
## ANÁLISE DE BUDGET
Calcule o % do gasto total que cada campanha consome vs. resultado que entrega (leads, conversões). Identifique "sorvedouras": consomem > 30% do budget mas entregam < 10% dos resultados. Recomende redistribuição com valores específicos em reais.`,
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  try {
    const body   = await req.json().catch(() => ({}))
    const skills: string[] = Array.isArray(body.skills) && body.skills.length > 0
      ? body.skills : ["gargalos"]

    const supabase = createServiceClient()
    const [configResult, campaigns, accountInsights] = await Promise.all([
      supabase.from("agent_configs").select("*").eq("tenant_id", tenant.tenant_id).single(),
      getCampaigns(tenant.tenant_id, "last_30d"),
      getInsights(tenant.tenant_id, "last_30d").catch(() => ({})),
    ])

    // Filter only active campaigns
    const active = campaigns.filter((c: any) => c.status === "ACTIVE")

    const now    = new Date()
    const period = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })

    if (active.length === 0) {
      const { data: report } = await supabase.from("reports").insert({
        tenant_id: tenant.tenant_id,
        title: `Relatório — ${period}`,
        period,
        summary: "## Sem campanhas ativas\n\nNenhuma campanha com status ACTIVE foi encontrada no período. Ative pelo menos uma campanha para gerar análise.",
        generated_by: "agent",
      }).select().single()
      return Response.json(report)
    }

    // Build compact data snapshot for Claude
    const campaignRows = active.map((c: any) => {
      const m = c.metrics ?? {}
      return [
        `**${c.name}** (${c.objective?.replace("OUTCOME_", "") ?? "?"})`,
        `Gasto: R$${Number(m.spend ?? 0).toFixed(2)}`,
        `Impressões: ${Number(m.impressions ?? 0).toLocaleString("pt-BR")}`,
        `Alcance: ${Number(m.reach ?? 0).toLocaleString("pt-BR")}`,
        `Cliques: ${Number(m.clicks ?? 0).toLocaleString("pt-BR")}`,
        `CTR: ${Number(m.ctr ?? 0).toFixed(2)}%`,
        `CPM: R$${Number(m.cpm ?? 0).toFixed(2)}`,
        `CPC: R$${Number(m.cpc ?? 0).toFixed(2)}`,
        m.leads     != null ? `Leads: ${m.leads}` : null,
        m.cpl       != null ? `CPL: R$${Number(m.cpl).toFixed(2)}` : null,
        m.roas      != null ? `ROAS: ${Number(m.roas).toFixed(2)}x` : null,
        m.frequency != null ? `Frequência: ${Number(m.frequency).toFixed(1)}` : null,
        m.conversations != null ? `Conversas WA: ${m.conversations}` : null,
        m.engagements   != null ? `Engajamentos: ${m.engagements}` : null,
      ].filter(Boolean).join(" | ")
    }).join("\n")

    const acc: any = accountInsights
    const accountSummary = `Conta (30 dias): Gasto R$${Number(acc.spend ?? 0).toFixed(2)} | Impressões ${Number(acc.impressions ?? 0).toLocaleString("pt-BR")} | Alcance ${Number(acc.reach ?? 0).toLocaleString("pt-BR")} | Cliques ${Number(acc.clicks ?? 0).toLocaleString("pt-BR")} | CTR ${Number(acc.ctr ?? 0).toFixed(2)}%`

    const config   = configResult.data ?? {}
    const configStr = `Objetivo: ${config.objetivo_principal ?? "não definido"} | ROAS mín: ${config.roas_minimo ?? "—"} | CPL máx: R$${config.cpl_maximo ?? "—"} | Budget mensal: R$${config.budget_mensal ?? "—"}`

    const skillSections = skills.map(s => SKILL_SECTIONS[s] ?? "").filter(Boolean).join("\n")

    const prompt = `Você é um especialista em Meta Ads. Analise os dados abaixo e gere um relatório executivo completo em português. Use markdown com ## para seções. Seja direto, objetivo e baseie TODA afirmação em números dos dados fornecidos — zero achismo.

CONFIGURAÇÕES DO CLIENTE:
${configStr}

RESUMO DA CONTA (últimos 30 dias):
${accountSummary}

CAMPANHAS ATIVAS (${active.length} de ${campaigns.length} total — pausadas ignoradas):
${campaignRows}

ESTRUTURA OBRIGATÓRIA DO RELATÓRIO:

## RESUMO EXECUTIVO
3-5 linhas: total investido, principal resultado, problema crítico identificado.

## RANKING DE CAMPANHAS ATIVAS
Ordene da melhor para a pior performance. Para cada uma: nome, métrica principal, status (otimizar/escalar/pausar) e justificativa com número.
${skillSections}

## RECOMENDAÇÕES PRIORITÁRIAS
Máximo 5 ações, ordenadas por impacto. Cada ação deve ser específica: "Pausar campanha X pois CPL R$63 é 4x o teto", não "otimize suas campanhas".

## PRÓXIMOS 7 DIAS
O que fazer agora, em ordem.`

    const apiKey = process.env.ANTHROPIC_API_KEY ?? ""
    let key = apiKey
    try {
      const { data: keys } = await supabase.from("platform_config").select("anthropic_api_key").single()
      if (keys?.anthropic_api_key) key = keys.anthropic_api_key
    } catch {}

    const client   = new Anthropic({ apiKey: key })
    const response = await client.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 4096,
      messages:   [{ role: "user", content: prompt }],
    })

    // Track usage
    supabase.rpc("increment_api_usage", {
      p_tenant_id:     tenant.tenant_id,
      p_period:        now.toISOString().slice(0, 7),
      p_input_tokens:  response.usage.input_tokens,
      p_output_tokens: response.usage.output_tokens,
    }).then(() => {})

    const summary = (response.content.find(b => b.type === "text") as any)?.text ?? ""

    const { data: report } = await supabase.from("reports").insert({
      tenant_id:    tenant.tenant_id,
      title:        `Relatório — ${period}`,
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
