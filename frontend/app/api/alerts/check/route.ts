import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { checkAndNotifyAlerts } from "@/lib/server/alerts"

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const { created, errors } = await checkAndNotifyAlerts(tenant.tenant_id)
  if (errors.some(e => e.startsWith("getCampaigns"))) {
    return Response.json({ error: "Meta não conectado" }, { status: 400 })
  }
  return Response.json({ created, errors })
}
