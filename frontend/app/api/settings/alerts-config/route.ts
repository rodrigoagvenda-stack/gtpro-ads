import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant } from "@/lib/server/auth"

export const ALERT_TYPES = [
  { type: "roas_baixo",         label: "ROAS abaixo do mínimo",         description: "Quando o ROAS da conta cair abaixo do valor configurado" },
  { type: "cpl_alto",           label: "CPL acima do máximo",           description: "Quando o custo por lead ultrapassar o limite definido" },
  { type: "budget_esgotado",    label: "Budget esgotado",               description: "Quando o orçamento diário de uma campanha esgotar" },
  { type: "campanha_rejeitada", label: "Campanha rejeitada",            description: "Quando o Meta rejeitar um anúncio ou campanha" },
  { type: "queda_performance",  label: "Queda de performance",          description: "Quando CTR ou ROAS cair mais de 20% em relação ao dia anterior" },
  { type: "sem_entrega",        label: "Campanha sem entrega",          description: "Campanha ativa há mais de 6h sem impressões" },
]

export async function GET(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from("alert_configs")
    .select("*")
    .eq("tenant_id", ctx.tenant_id)

  // Merge saved config with defaults
  const saved = Object.fromEntries((data ?? []).map(r => [r.alert_type, r]))
  const result = ALERT_TYPES.map(t => ({
    ...t,
    enabled:  saved[t.type]?.enabled  ?? true,
    channels: saved[t.type]?.channels ?? ["in_app"],
  }))

  return Response.json(result)
}

export async function POST(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const body: { type: string; enabled: boolean; channels: string[] }[] = await req.json()
  const supabase = createServiceClient()

  for (const item of body) {
    await supabase.from("alert_configs").upsert(
      { tenant_id: ctx.tenant_id, alert_type: item.type, enabled: item.enabled, channels: item.channels },
      { onConflict: "tenant_id,alert_type" }
    )
  }

  return Response.json({ success: true })
}
