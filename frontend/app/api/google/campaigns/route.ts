import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getGoogleCampaigns, toggleGoogleCampaign, createGoogleCampaign } from "@/lib/server/google-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const datePreset = req.nextUrl.searchParams.get("date_preset") ?? "last_7d"
    const campaigns = await getGoogleCampaigns(tenant.tenant_id, datePreset)
    return Response.json(campaigns)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const { name, daily_budget, channel_type } = await req.json()
    if (!name || !daily_budget || !channel_type)
      return Response.json({ error: "name, daily_budget e channel_type são obrigatórios" }, { status: 400 })
    const result = await createGoogleCampaign(tenant.tenant_id, {
      name,
      dailyBudget: Number(daily_budget),
      channelType: channel_type,
    })
    return Response.json(result)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

export async function PATCH(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const { campaign_id, status } = await req.json()
    if (!campaign_id) return Response.json({ error: "campaign_id obrigatório" }, { status: 400 })
    await toggleGoogleCampaign(tenant.tenant_id, campaign_id, status === "ENABLED")
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
