import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"
import { sendWhatsApp } from "@/lib/server/whatsapp"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const status = req.nextUrl.searchParams.get("status") ?? "active"
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("alerts")
    .select("*")
    .eq("tenant_id", tenant.tenant_id)
    .eq("status", status)
    .order("created_at", { ascending: false })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const body = await req.json()
  const supabase = createServiceClient()

  const { data: alert } = await supabase
    .from("alerts")
    .insert({ tenant_id: tenant.tenant_id, type: body.type, message: body.message, status: "active" })
    .select()
    .single()

  // Check if this alert type is enabled and whatsapp channel is configured
  const { data: cfg } = await supabase
    .from("alert_configs")
    .select("enabled, channels")
    .eq("tenant_id", tenant.tenant_id)
    .eq("alert_type", body.type)
    .single()

  const channels = cfg?.channels ?? ["in_app"]
  const enabled  = cfg?.enabled  ?? true

  if (enabled && channels.includes("whatsapp")) {
    const { data: agentCfg } = await supabase
      .from("agent_configs")
      .select("whatsapp_number, alerts_whatsapp_enabled")
      .eq("tenant_id", tenant.tenant_id)
      .single()

    if (agentCfg?.alerts_whatsapp_enabled && agentCfg?.whatsapp_number) {
      const LABELS: Record<string, string> = {
        roas_baixo: "ROAS Baixo", cpl_alto: "CPL Alto", budget_esgotado: "Budget Esgotado",
        campanha_rejeitada: "Campanha Rejeitada", queda_performance: "Queda de Performance", sem_entrega: "Sem Entrega",
      }
      await sendWhatsApp(
        agentCfg.whatsapp_number,
        `*GTPRO Alerta — ${LABELS[body.type] ?? body.type}*\n\n${body.message}`
      )
    }
  }

  return Response.json(alert)
}
