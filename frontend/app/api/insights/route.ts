import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getInsights } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const datePreset = req.nextUrl.searchParams.get("date_preset") ?? "last_7d"
  try {
    const data = await getInsights(tenant.tenant_id, datePreset)
    return Response.json(data)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
