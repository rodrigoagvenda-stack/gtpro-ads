import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getVideoSource } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const videoId = req.nextUrl.searchParams.get("video_id")
  if (!videoId) return Response.json({ error: "missing video_id" }, { status: 400 })

  try {
    const result = await getVideoSource(tenant.tenant_id, videoId)
    return Response.json(result)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
