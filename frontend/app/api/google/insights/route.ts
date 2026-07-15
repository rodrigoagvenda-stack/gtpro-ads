import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getGoogleInsights } from "@/lib/server/google-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const datePreset = req.nextUrl.searchParams.get("date_preset") ?? "last_7d"
    const insights = await getGoogleInsights(tenant.tenant_id, datePreset)
    return Response.json(insights)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
