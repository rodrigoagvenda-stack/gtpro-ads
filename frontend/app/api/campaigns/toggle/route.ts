import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { toggleCampaign } from "@/lib/server/meta-ads"

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const { campaign_id, status } = await req.json()
  const data = await toggleCampaign(tenant.tenant_id, campaign_id, status)
  return Response.json(data)
}
