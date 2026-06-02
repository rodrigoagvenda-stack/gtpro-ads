import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { searchInterests } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const q = req.nextUrl.searchParams.get("q") ?? ""
  if (!q.trim()) return Response.json([])

  try {
    const results = await searchInterests(tenant.tenant_id, q)
    return Response.json(results)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
