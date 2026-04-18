import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant } from "@/lib/server/auth"
import { getUazapiQR } from "@/lib/server/whatsapp"

// GET — returns platform whatsapp config + QR if uazapi
export async function GET(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const supabase = createServiceClient()
  const { data: rows } = await supabase
    .from("platform_settings")
    .select("key, value_encrypted")
    .in("key", ["whatsapp_provider", "whatsapp_uazapi_url", "whatsapp_uazapi_instance", "whatsapp_official_phone_id"])

  const cfg: Record<string, string> = {}
  rows?.forEach(r => { cfg[r.key] = r.value_encrypted })

  const { data: agentCfg } = await supabase
    .from("agent_configs")
    .select("whatsapp_number, alerts_whatsapp_enabled")
    .eq("tenant_id", ctx.tenant_id)
    .single()

  let qr = null, connected = false
  if (cfg.whatsapp_provider === "uazapi") {
    const result = await getUazapiQR()
    qr = result.qr
    connected = result.status === "connected"
  }

  return Response.json({
    provider: cfg.whatsapp_provider || null,
    uazapi_url: cfg.whatsapp_uazapi_url || "",
    uazapi_instance: cfg.whatsapp_uazapi_instance || "",
    official_phone_id: cfg.whatsapp_official_phone_id || "",
    qr,
    connected,
    whatsapp_number: agentCfg?.whatsapp_number ?? "",
    alerts_whatsapp_enabled: agentCfg?.alerts_whatsapp_enabled ?? false,
  })
}

// POST — saves platform config + tenant number
export async function POST(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const body = await req.json()
  const supabase = createServiceClient()

  const platformKeys: Record<string, string> = {}
  if (body.provider !== undefined)           platformKeys.whatsapp_provider = body.provider
  if (body.uazapi_url !== undefined)         platformKeys.whatsapp_uazapi_url = body.uazapi_url
  if (body.uazapi_key !== undefined)         platformKeys.whatsapp_uazapi_key = body.uazapi_key
  if (body.uazapi_instance !== undefined)    platformKeys.whatsapp_uazapi_instance = body.uazapi_instance
  if (body.official_token !== undefined)     platformKeys.whatsapp_official_token = body.official_token
  if (body.official_phone_id !== undefined)  platformKeys.whatsapp_official_phone_id = body.official_phone_id

  for (const [key, value] of Object.entries(platformKeys)) {
    await supabase.from("platform_settings").upsert({ key, value_encrypted: value, updated_at: new Date().toISOString() }, { onConflict: "key" })
  }

  if (body.whatsapp_number !== undefined || body.alerts_whatsapp_enabled !== undefined) {
    await supabase.from("agent_configs").update({
      ...(body.whatsapp_number !== undefined ? { whatsapp_number: body.whatsapp_number } : {}),
      ...(body.alerts_whatsapp_enabled !== undefined ? { alerts_whatsapp_enabled: body.alerts_whatsapp_enabled } : {}),
    }).eq("tenant_id", ctx.tenant_id)
  }

  return Response.json({ success: true })
}
