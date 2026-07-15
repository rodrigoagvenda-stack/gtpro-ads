import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getGoogleConnections } from "@/lib/server/google-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const accounts = await getGoogleConnections(tenant.tenant_id)
    const active = accounts.find((a: any) => a.is_active)
    return Response.json({ connected: accounts.length > 0, active, accounts })
  } catch (e: any) {
    return Response.json({ connected: false, error: e.message })
  }
}
