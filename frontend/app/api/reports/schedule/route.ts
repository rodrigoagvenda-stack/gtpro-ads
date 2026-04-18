import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("agent_configs")
    .select("report_schedule, report_whatsapp, report_last_sent_at")
    .eq("tenant_id", tenant.tenant_id)
    .single()
  return Response.json(data ?? { report_schedule: "none", report_whatsapp: false, report_last_sent_at: null })
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const { schedule, whatsapp } = await req.json()
  const supabase = createServiceClient()
  await supabase.from("agent_configs")
    .update({ report_schedule: schedule, report_whatsapp: whatsapp })
    .eq("tenant_id", tenant.tenant_id)
  return Response.json({ success: true })
}
