import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getIgMedia, getPageToken } from "@/lib/server/instagram"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const igUserId = req.nextUrl.searchParams.get("ig_user_id")
  if (!igUserId) return Response.json({ error: "ig_user_id obrigatório" }, { status: 400 })
  try {
    const token = await getPageToken(tenant.tenant_id, igUserId)
    const posts = await getIgMedia(igUserId, token)
    return Response.json(posts)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
