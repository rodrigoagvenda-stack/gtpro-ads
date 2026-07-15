import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getGoogleConnections, switchGoogleConnection } from "@/lib/server/google-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const accounts = await getGoogleConnections(tenant.tenant_id)
    return Response.json(accounts)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const { id } = await req.json()
    if (!id) return Response.json({ error: "id obrigatório" }, { status: 400 })
    await switchGoogleConnection(tenant.tenant_id, id)
    return Response.json({ ok: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
