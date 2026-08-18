import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getGA4Connections } from "@/lib/server/ga4"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const accounts = await getGA4Connections(tenant.tenant_id)
  const active = accounts.find((a: any) => a.is_active)

  return Response.json({
    connected: accounts.length > 0,
    active:    active ?? null,
    accounts,
  })
}
