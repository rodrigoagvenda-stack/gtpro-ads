import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"
import { getInsights, getCampaigns } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const tid = tenant.tenant_id
  const supabase = createServiceClient()

  const [insights, campaigns, alerts, leads, logs] = await Promise.allSettled([
    getInsights(tid, "this_month"),
    getCampaigns(tid),
    supabase.from("alerts").select("*").eq("tenant_id", tid).eq("status", "active").order("created_at", { ascending: false }).limit(5),
    supabase.from("leads").select("id,name,utm_campaign,created_at").eq("tenant_id", tid).order("created_at", { ascending: false }).limit(5),
    supabase.from("agent_logs").select("id,action,status,created_at").eq("tenant_id", tid).order("created_at", { ascending: false }).limit(5),
  ])

  const insightsData   = insights.status   === "fulfilled" ? insights.value   : {}
  const campaignsData  = campaigns.status  === "fulfilled" ? campaigns.value  : []
  const alertsData     = alerts.status     === "fulfilled" ? (alerts.value.data ?? [])   : []
  const leadsData      = leads.status      === "fulfilled" ? (leads.value.data ?? [])    : []
  const logsData       = logs.status       === "fulfilled" ? (logs.value.data ?? [])     : []

  const activeCampaigns = (campaignsData as any[]).filter((c: any) => c.status === "ACTIVE")

  return Response.json({
    insights: insightsData,
    active_campaigns: activeCampaigns.length,
    total_campaigns: (campaignsData as any[]).length,
    top_campaigns: (campaignsData as any[]).slice(0, 4),
    active_alerts: alertsData.length,
    alerts: alertsData,
    leads: leadsData,
    agent_logs: logsData,
  })
}
