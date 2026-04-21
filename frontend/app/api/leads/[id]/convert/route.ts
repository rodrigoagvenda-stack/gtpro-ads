import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"
import { sendCAPIEvent } from "@/lib/server/capi"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const { id } = await params
  const { value }: { value?: number } = await req.json().catch(() => ({}))

  const supabase = createServiceClient()

  const { data: lead, error: fetchErr } = await supabase
    .from("leads")
    .select("id, tenant_id, email, phone, name, fbclid, page_url, converted_at")
    .eq("id", id)
    .eq("tenant_id", tenant.tenant_id)
    .single()

  if (fetchErr || !lead) return Response.json({ error: "Lead não encontrado" }, { status: 404 })
  if (lead.converted_at)  return Response.json({ error: "Já convertido" }, { status: 409 })

  const now = new Date().toISOString()
  const { error: updateErr } = await supabase
    .from("leads")
    .update({ converted_at: now, conversion_value: value ?? null })
    .eq("id", id)

  if (updateErr) return Response.json({ error: updateErr.message }, { status: 500 })

  // Fire CAPI Purchase event (best-effort)
  const firstName = (lead.name as string | null)?.split(" ")[0] ?? null
  sendCAPIEvent(tenant.tenant_id, {
    eventName:      "Purchase",
    eventId:        `purchase_${id}`,
    email:          lead.email,
    phone:          lead.phone,
    firstName,
    eventSourceUrl: lead.page_url,
    fbclid:         lead.fbclid,
    value:          value ?? null,
    currency:       "BRL",
  }).then(sent => {
    if (sent) {
      supabase.from("leads").update({ capi_purchase_sent: true }).eq("id", id).then(() => {})
    }
  })

  return Response.json({ success: true, converted_at: now })
}
