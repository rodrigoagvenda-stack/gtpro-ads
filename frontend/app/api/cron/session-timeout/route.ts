import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { sendText } from "@/lib/server/whatsapp"

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (req.headers.get("authorization") ?? "") === `Bearer ${secret}`
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()

  // Sessions active (not idle) and untouched for 5+ minutes
  const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data: sessions, error } = await supabase
    .from("whatsapp_sessions")
    .select("phone, tenant_id, step")
    .neq("step", "idle")
    .lt("updated_at", cutoff)

  if (error) {
    console.error("[session-timeout] fetch error:", error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!sessions?.length) {
    return Response.json({ ok: true, expired: 0 })
  }

  // Batch fetch user names
  const tenantIds = [...new Set(sessions.map(s => s.tenant_id))]
  const { data: configs } = await supabase
    .from("agent_configs")
    .select("tenant_id, user_name")
    .in("tenant_id", tenantIds)

  const nameMap = Object.fromEntries(
    (configs ?? []).map(c => [c.tenant_id, (c.user_name ?? "").trim() || ""])
  )

  let expired = 0

  for (const session of sessions) {
    const name  = nameMap[session.tenant_id] || ""
    const phone = session.phone.replace(/\D/g, "")

    try {
      await sendText(
        phone,
        name
          ? `Fala, *${name}*! Notei que você não respondeu, estou finalizando seu atendimento. 👋`
          : `Notei que você não respondeu, estou finalizando seu atendimento. 👋`
      )
      await sendText(phone, `Qualquer dúvida é só me mandar uma mensagem. Estarei por aqui! 😊`)

      // Reset session to idle
      await supabase
        .from("whatsapp_sessions")
        .update({ step: "idle", context: {}, updated_at: new Date().toISOString() })
        .eq("phone", session.phone)

      expired++
    } catch (e: any) {
      console.error(`[session-timeout] error for ${phone}:`, e.message)
    }
  }

  console.log(`[session-timeout] expired ${expired} session(s)`)
  return Response.json({ ok: true, expired })
}
