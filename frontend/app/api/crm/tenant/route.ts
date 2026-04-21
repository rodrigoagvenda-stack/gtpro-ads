import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"

// Secured by CRON_SECRET — called exclusively by your CRM
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get("authorization") === `Bearer ${secret}`
}

// PATCH /api/crm/tenant — block or unblock a tenant
// Body: { tenant_id: string, active: boolean, reason?: string }
export async function PATCH(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { tenant_id, active, reason } = await req.json()
  if (!tenant_id || typeof active !== "boolean") {
    return Response.json({ error: "tenant_id e active são obrigatórios" }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from("tenants")
    .update({ active, blocked_reason: active ? null : (reason ?? "Blocked by CRM") })
    .eq("id", tenant_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true, tenant_id, active })
}

// GET /api/crm/tenant?tenant_id=xxx — check status + usage
export async function GET(req: NextRequest) {
  if (!authorized(req)) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const tenantId = req.nextUrl.searchParams.get("tenant_id")
  if (!tenantId) return Response.json({ error: "tenant_id obrigatório" }, { status: 400 })

  const supabase  = createServiceClient()
  const period    = new Date().toISOString().slice(0, 7) // YYYY-MM

  const [tenantRes, usageRes] = await Promise.all([
    supabase.from("tenants").select("id, active, blocked_reason, created_at").eq("id", tenantId).single(),
    supabase.from("api_usage").select("input_tokens, output_tokens, calls").eq("tenant_id", tenantId).eq("period", period).single(),
  ])

  const usage    = usageRes.data
  const costUSD  = usage
    ? (usage.input_tokens * 3 / 1_000_000) + (usage.output_tokens * 15 / 1_000_000)
    : 0

  return Response.json({
    ...tenantRes.data,
    usage_this_month: usage ?? { input_tokens: 0, output_tokens: 0, calls: 0 },
    estimated_cost_usd: Number(costUSD.toFixed(4)),
  })
}
