import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getCustomAudiences, createLookalikeAudience, createWebsiteAudience, createEngagementAudience } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const data = await getCustomAudiences(tenant.tenant_id)
    return Response.json(data)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const body = await req.json()
  const { type, ...params } = body
  if (!type) return Response.json({ error: "type obrigatório (lookalike | website | engagement)" }, { status: 400 })
  try {
    let data: any
    if (type === "lookalike")   data = await createLookalikeAudience(tenant.tenant_id, params)
    else if (type === "website")     data = await createWebsiteAudience(tenant.tenant_id, params)
    else if (type === "engagement")  data = await createEngagementAudience(tenant.tenant_id, params)
    else return Response.json({ error: `Tipo desconhecido: ${type}` }, { status: 400 })
    return Response.json(data)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
