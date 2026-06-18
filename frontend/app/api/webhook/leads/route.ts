import { NextRequest } from "next/server"
import crypto from "crypto"
import { createServiceClient } from "@/lib/server/supabase"
import { sendCAPIEvent } from "@/lib/server/capi"
import { getTenant } from "@/lib/server/auth"

// Public endpoint — aceita x-api-key (webhook_token legado) ou Authorization: Bearer (api_keys)
export async function POST(req: NextRequest) {
  const supabase = createServiceClient()
  let tenantId: string | null = null

  const xApiKey = req.headers.get("x-api-key") ?? req.nextUrl.searchParams.get("api_key")

  if (xApiKey) {
    // Modo legado: valida contra agent_configs.webhook_token
    const { data: config } = await supabase
      .from("agent_configs")
      .select("tenant_id")
      .eq("webhook_token", xApiKey)
      .single()
    tenantId = config?.tenant_id ?? null
  } else {
    // Modo API Key: Authorization: Bearer gtpro_xxx → api_keys table
    const ctx = await getTenant(req)
    tenantId = ctx?.tenant_id ?? null
  }

  if (!tenantId) return Response.json({ error: "API key inválida" }, { status: 401 })

  // ─── Rate limit: max 30 leads/minute per tenant ──────────────────────────────
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString()
  const { count } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", oneMinuteAgo)
  if ((count ?? 0) >= 30) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  const body = await req.json().catch(() => ({}))

  const email: string | null = body.email ?? null
  const phone: string | null = body.phone ?? body.whatsapp ?? null

  // ─── Deduplication: same email or phone within 24 h ─────────────────────────
  const raw = `${email ?? ""}|${phone?.replace(/\D/g, "") ?? ""}`
  const dedupKey = raw === "|" ? null : crypto.createHash("sha256").update(`${tenantId}:${raw}`).digest("hex")

  if (dedupKey) {
    const { data: existing } = await supabase
      .from("leads")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("dedup_key", dedupKey)
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString())
      .maybeSingle()
    if (existing) {
      return Response.json({ success: true, duplicate: true })
    }
  }

  // ─── Insert lead ─────────────────────────────────────────────────────────────
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null

  const { data: lead, error } = await supabase
    .from("leads")
    .insert({
      tenant_id:    tenantId,
      name:         body.name ?? body.contact_name ?? body.nome_completo ?? null,
      phone,
      email,
      segment:      body.segment ?? null,
      utm_source:   body.utm_source ?? null,
      utm_medium:   body.utm_medium ?? null,
      utm_campaign: body.utm_campaign ?? null,
      utm_content:  body.utm_content ?? null,
      utm_term:     body.utm_term ?? null,
      fbclid:       body.fbclid ?? null,
      page_url:     body.page_url ?? req.headers.get("referer") ?? null,
      source:       body.source ?? "webhook",
      metadata:     body.metadata ?? {},
      dedup_key:    dedupKey,
      ip_address:   ip,
    })
    .select("id")
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  // ─── CAPI Lead event (best-effort, do not block response) ───────────────────
  const name: string | null = body.name ?? body.contact_name ?? body.nome_completo ?? null
  const firstName = name?.split(" ")[0] ?? null
  sendCAPIEvent(tenantId, {
    eventName:      "Lead",
    eventId:        lead.id,
    email,
    phone,
    firstName,
    eventSourceUrl: body.page_url ?? req.headers.get("referer") ?? null,
    fbclid:         body.fbclid ?? null,
    value:          body.value ?? null,
  }).then(sent => {
    if (sent) {
      supabase.from("leads").update({ capi_lead_sent: true }).eq("id", lead.id).then(() => {})
    }
  })

  return Response.json({ success: true, id: lead.id })
}
