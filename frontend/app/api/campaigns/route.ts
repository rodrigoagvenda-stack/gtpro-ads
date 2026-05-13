import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getCampaigns } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const datePreset = req.nextUrl.searchParams.get("date_preset") ?? "last_7d"
  console.log(`[campaigns] GET user=${tenant.user_id} tenant_id=${tenant.tenant_id}`)
  try {
    const data = await getCampaigns(tenant.tenant_id, datePreset)
    return Response.json(data)
  } catch (e: any) {
    console.log(`[campaigns] ERROR for tenant_id=${tenant.tenant_id}: ${e.message}`)
    return Response.json({ error: e.message, debug_tenant_id: tenant.tenant_id }, { status: 500 })
  }
}
