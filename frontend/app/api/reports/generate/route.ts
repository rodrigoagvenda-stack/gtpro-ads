import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { runAgent } from "@/lib/server/agent"
import { createServiceClient } from "@/lib/server/supabase"

const SKILL_PROMPTS: Record<string, string> = {
  gargalos: `
ANÁLISE DE GARGALOS (obrigatória):
- Identifique em qual etapa do funil há maior queda (Impressões → Cliques → Conversões)
- Calcule a taxa de conversão entre cada etapa e aponte a pior
- Indique se o problema é de alcance, CTR baixo, CPL alto ou conversão pós-clique
- Seja específico: "campanha X tem CTR de 0.3% quando a média é 1.5% — gargalo no criativo"
- Nunca use achismo: toda afirmação deve ter número que a justifique`,

  criativo: `
ANÁLISE DE CRIATIVO:
- Verifique CTR e frequência de cada campanha ativa
- Frequência > 3.0 = criativo saturado, recomende troca
- CTR < 0.8% = criativo não engaja, recomende novo teste A/B
- Aponte qual campanha tem melhor CTR e por que (imagem vs vídeo se disponível)
- Recomende formatos para teste com base nos dados`,

  copy: `
ANÁLISE DE COPY/MENSAGEM:
- Analise qual campanha tem melhor taxa de clique-para-lead (CTR alto mas CPL baixo = boa copy)
- Aponte divergências: CTR bom mas poucos leads = copy atraente mas promessa errada
- Recomende ângulos de mensagem baseados nos dados de conversão
- Identifique campanhas onde a copy pode estar gerando leads desqualificados (alto volume, baixa qualidade)`,

  publico: `
ANÁLISE DE PÚBLICO:
- Verifique CPL e ROAS por campanha — variações grandes indicam públicos diferentes respondendo diferente
- Identifique qual campanha tem menor CPL (público mais qualificado)
- Recomende criação de lookalike baseado na campanha de melhor performance
- Aponte se há sobreposição de público entre campanhas ativas que possa estar inflando CPM`,

  budget: `
ANÁLISE DE BUDGET:
- Calcule o percentual do orçamento que cada campanha ativa consome vs. resultado que entrega
- Identifique campanhas "sorvedouras": gastam muito, entregam pouco
- Recomende redistribuição de budget com valores específicos (ex: "mover R$50/dia de X para Y")
- Projete impacto: "se redistribuir, estimativa de redução de CPL de X para Y"`,
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const skills: string[] = Array.isArray(body.skills) && body.skills.length > 0
    ? body.skills
    : ["gargalos"]

  const supabase = createServiceClient()
  const { data: config } = await supabase
    .from("agent_configs")
    .select("*")
    .eq("tenant_id", tenant.tenant_id)
    .single()

  const now    = new Date()
  const period = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })

  const skillInstructions = skills.map(s => SKILL_PROMPTS[s] ?? "").filter(Boolean).join("\n")

  const message = `Gere um relatório detalhado de performance dos últimos 30 dias.

REGRAS OBRIGATÓRIAS:
1. Use get_campaigns para listar as campanhas
2. IGNORE completamente campanhas com status PAUSED, ARCHIVED ou DELETED — analise SOMENTE status ACTIVE
3. Para cada campanha ativa, busque insights com get_campaign_insights
4. Toda afirmação deve ter número que a justifique — zero achismo
5. Seja direto e objetivo, use listas e números

ESTRUTURA DO RELATÓRIO:
1. RESUMO EXECUTIVO (3-5 linhas: investimento total, resultado principal, problema crítico)
2. CAMPANHAS ATIVAS — tabela com: Nome | Gasto | Leads/Conversões | CPL/CPA | ROAS | CTR
3. RANKING DE PERFORMANCE (melhor para pior, justificando com métricas)
${skillInstructions}
4. RECOMENDAÇÕES PRIORITÁRIAS (máximo 5, ordenadas por impacto estimado, com ação específica)
5. PRÓXIMOS 7 DIAS (o que fazer agora)

Importante: se não houver campanhas ativas, informe claramente e pare.`

  const result = await runAgent(tenant.tenant_id, message, config ?? {})

  const { data: report } = await supabase
    .from("reports")
    .insert({
      tenant_id:    tenant.tenant_id,
      title:        `Relatório — ${period}`,
      period,
      summary:      result.message,
      generated_by: "agent",
    })
    .select()
    .single()

  return Response.json(report)
}
