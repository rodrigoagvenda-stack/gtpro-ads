import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getCampaignBreakdowns } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const { id } = await params
  const breakdown = req.nextUrl.searchParams.get("breakdown") ?? "age,gender"
  const datePreset = req.nextUrl.searchParams.get("date_preset") ?? "last_7d"
  try {
    const data = await getCampaignBreakdowns(tenant.tenant_id, id, breakdown, datePreset)
    return Response.json(data)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
