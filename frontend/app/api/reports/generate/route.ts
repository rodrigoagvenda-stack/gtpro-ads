import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { runAgent } from "@/lib/server/agent"
import { createServiceClient } from "@/lib/server/supabase"

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const supabase = createServiceClient()
  const { data: config } = await supabase
    .from("agent_configs")
    .select("*")
    .eq("tenant_id", tenant.tenant_id)
    .single()

  const now = new Date()
  const period = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })

  const message = `Gere um relatório detalhado de performance dos últimos 30 dias focado apenas nas campanhas ATIVAS. Use get_campaigns para listar as campanhas, filtre somente as com status ACTIVE, e use get_campaign_insights para cada uma. Inclua: resumo executivo, ranking de campanhas ativas por ROAS e CPL, métricas principais (ROAS, CPL, CTR, CPC, Impressões, Cliques, Leads), identificação de campanhas para otimizar ou pausar, e recomendações prioritárias de ação para o próximo período. Seja objetivo e use listas.`

  const result = await runAgent(tenant.tenant_id, message, config ?? {})

  const { data: report } = await supabase
    .from("reports")
    .insert({
      tenant_id: tenant.tenant_id,
      title: `Relatório — ${period}`,
      period,
      summary: result.message,
      generated_by: "agent",
    })
    .select()
    .single()

  return Response.json(report)
}
