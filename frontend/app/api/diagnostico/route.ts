import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"
import { getPixels, getPixelStats, getAccountInfo } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const supabase = createServiceClient()
  const tid = tenant.tenant_id
  const results: Record<string, any> = {}

  // Meta connection
  try {
    const { data: conn } = await supabase
      .from("meta_connections")
      .select("ad_account_id,active,is_active,updated_at")
      .eq("tenant_id", tid)
      .eq("active", true)
      .eq("is_active", true)
      .maybeSingle()
    results.meta_connection = conn
      ? { status: "connected", ad_account_id: conn.ad_account_id, updated_at: conn.updated_at }
      : { status: "disconnected" }
  } catch { results.meta_connection = { status: "error" } }

  // Google Ads connection
  try {
    const { data: gconn } = await supabase
      .from("google_connections")
      .select("customer_id,customer_name,is_active,updated_at")
      .eq("tenant_id", tid)
      .eq("is_active", true)
      .maybeSingle()
    results.google_connection = gconn
      ? { status: "connected", customer_id: gconn.customer_id, customer_name: gconn.customer_name, updated_at: gconn.updated_at }
      : { status: "disconnected" }
  } catch { results.google_connection = { status: "disconnected" } }

  // Pixels
  try {
    const pixels = await getPixels(tid)
    const pixelChecks = await Promise.all(
      (pixels ?? []).slice(0, 3).map(async (px: any) => {
        try {
          const stats = await getPixelStats(tid, px.id, "last_7d")
          const totalEvents = Array.isArray(stats)
            ? stats.reduce((s: number, e: any) => s + Number(e.count ?? 0), 0)
            : 0
          return { id: px.id, name: px.name, events_7d: totalEvents, status: totalEvents > 0 ? "firing" : "idle" }
        } catch {
          return { id: px.id, name: px.name, events_7d: 0, status: "error" }
        }
      })
    )
    results.pixels = pixelChecks
  } catch { results.pixels = [] }

  // Account info (spend, limit)
  try {
    const info = await getAccountInfo(tid)
    results.account = {
      currency:     info?.currency ?? "BRL",
      spend_cap:    info?.spend_cap ?? null,
      amount_spent: info?.amount_spent ?? null,
      status:       info?.account_status ?? null,
    }
  } catch { results.account = null }

  // Budget summary
  try {
    const { data: cfg } = await supabase
      .from("agent_configs")
      .select("budget_mensal,roas_minimo,cpl_maximo")
      .eq("tenant_id", tid)
      .single()
    results.config = cfg ?? {}
  } catch { results.config = {} }

  // Active alerts count
  try {
    const { count } = await supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .eq("status", "active")
    results.active_alerts = count ?? 0
  } catch { results.active_alerts = 0 }

  // Recent agent actions (last 24h)
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { count } = await supabase
      .from("agent_logs")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tid)
      .gte("created_at", since)
    results.agent_actions_24h = count ?? 0
  } catch { results.agent_actions_24h = 0 }

  return Response.json(results)
}
