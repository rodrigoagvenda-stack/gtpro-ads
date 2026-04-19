import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getPixels, getCustomConversions } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const [pixels, conversions] = await Promise.all([
      getPixels(tenant.tenant_id),
      getCustomConversions(tenant.tenant_id),
    ])
    return Response.json({ pixels, conversions })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
