import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getInsights, invalidateActiveConnection } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const { searchParams } = req.nextUrl
  const datePreset = searchParams.get("date_preset") ?? "last_7d"
  const since = searchParams.get("since") ?? undefined
  const until = searchParams.get("until") ?? undefined
  try {
    const data = await getInsights(tenant.tenant_id, datePreset, since, until)
    return Response.json(data)
  } catch (e: any) {
    if (e.code === 190) await invalidateActiveConnection(tenant.tenant_id)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
