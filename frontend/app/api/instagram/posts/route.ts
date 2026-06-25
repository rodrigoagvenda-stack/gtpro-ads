import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getIgMedia } from "@/lib/server/instagram"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const igUserId = req.nextUrl.searchParams.get("ig_user_id")
  if (!igUserId) return Response.json({ error: "ig_user_id obrigatório" }, { status: 400 })
  try {
    const posts = await getIgMedia(tenant.tenant_id, igUserId)
    return Response.json(posts)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
