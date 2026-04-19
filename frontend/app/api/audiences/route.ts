import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getCustomAudiences } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const data = await getCustomAudiences(tenant.tenant_id)
    return Response.json(data)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
