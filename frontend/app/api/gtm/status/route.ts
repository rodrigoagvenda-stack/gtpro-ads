import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getGTMConnections } from "@/lib/server/gtm"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const accounts = await getGTMConnections(tenant.tenant_id)
  const active = accounts.find((a: any) => a.is_active)

  return Response.json({
    connected: accounts.length > 0,
    active:    active ?? null,
    accounts,
  })
}
