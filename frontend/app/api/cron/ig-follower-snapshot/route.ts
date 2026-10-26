import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { snapshotFollowerCounts } from "@/lib/server/instagram"

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get("authorization") ?? ""
  return auth === `Bearer ${secret}`
}

// Roda uma vez por dia: grava o total de seguidores de cada conta IG conectada.
// A Meta não expõe esse histórico retroativamente — sem este snapshot diário não tem
// como medir crescimento de seguidores ao longo de uma iniciativa de conteúdo.
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: tenants, error } = await supabase
    .from("ig_accounts")
    .select("tenant_id")

  if (error) {
    console.error("[cron ig-follower-snapshot] fetch error:", error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  const tenantIds = [...new Set((tenants ?? []).map(t => t.tenant_id))]
  if (!tenantIds.length) {
    return Response.json({ ok: true, processed: 0, reason: "no tenants with ig_accounts" })
  }

  const results: Array<{ tenant_id: string; status: string; count?: number; error?: string }> = []
  for (const tenantId of tenantIds) {
    try {
      const rows = await snapshotFollowerCounts(tenantId)
      results.push({ tenant_id: tenantId, status: "ok", count: rows.length })
    } catch (e: any) {
      console.error(`[cron ig-follower-snapshot] error for tenant ${tenantId}:`, e.message)
      results.push({ tenant_id: tenantId, status: "error", error: e.message })
    }
  }

  return Response.json({ ok: true, processed: tenantIds.length, results })
}
