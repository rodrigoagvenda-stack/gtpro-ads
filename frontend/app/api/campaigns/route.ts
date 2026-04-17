import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getCampaigns } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const data = await getCampaigns(tenant.tenant_id)
    return Response.json(data)
  } catch {
    return Response.json([])
  }
}
