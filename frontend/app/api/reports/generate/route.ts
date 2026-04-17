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

  const message = `Gere um relatório detalhado de performance dos últimos 30 dias. Inclua: resumo executivo, campanhas com melhor e pior performance, métricas principais (ROAS, CPL, CTR, CPC, Impressões, Cliques), tendências identificadas, e recomendações de otimização prioritárias para o próximo período.`

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
