import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

const DEFAULTS = {
  objetivo_principal: "LEADS",
  roas_minimo: 2,
  cpl_maximo: 50,
  budget_mensal: null,
  modo_supervisionado: true,
  limite_budget_sem_aprovacao: 100,
}

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const supabase = createServiceClient()
  const { data } = await supabase
    .from("agent_configs")
    .select("*")
    .eq("tenant_id", tenant.tenant_id)
    .single()

  return Response.json(data ?? DEFAULTS)
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const body = await req.json()
  const supabase = createServiceClient()

  const { error } = await supabase
    .from("agent_configs")
    .upsert(
      { tenant_id: tenant.tenant_id, ...body, updated_at: new Date().toISOString() },
      { onConflict: "tenant_id" }
    )

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}
