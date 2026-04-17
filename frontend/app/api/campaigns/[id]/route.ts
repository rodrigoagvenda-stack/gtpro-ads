import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getAdSets, getAds, getCampaignInsights } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const { id } = await params
  const datePreset = req.nextUrl.searchParams.get("date_preset") ?? "last_7d"

  try {
    const [adSets, ads, insights] = await Promise.all([
      getAdSets(tenant.tenant_id, id),
      getAds(tenant.tenant_id, id),
      getCampaignInsights(tenant.tenant_id, id, datePreset),
    ])
    return Response.json({ ad_sets: adSets, ads, insights })
  } catch (e: any) {
    return Response.json({ ad_sets: [], ads: [], insights: {}, error: e.message })
  }
}
