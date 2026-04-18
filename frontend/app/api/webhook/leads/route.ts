import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"

// Public endpoint — authenticated by x-api-key header matching webhook_token
export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key") ?? req.nextUrl.searchParams.get("api_key")
  if (!apiKey) return Response.json({ error: "x-api-key obrigatório" }, { status: 401 })

  const supabase = createServiceClient()

  const { data: config } = await supabase
    .from("agent_configs")
    .select("tenant_id, webhook_token")
    .eq("webhook_token", apiKey)
    .single()

  if (!config) return Response.json({ error: "API key inválida" }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  const { error } = await supabase.from("leads").insert({
    tenant_id:    config.tenant_id,
    name:         body.name ?? body.contact_name ?? body.nome_completo ?? null,
    phone:        body.phone ?? body.whatsapp ?? null,
    email:        body.email ?? null,
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
  })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ success: true })
}
