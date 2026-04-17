import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getSetting, setSetting, getMetaAppId } from "@/lib/server/platform"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  return Response.json({
    anthropic_api_key_set: !!(await getSetting("anthropic_api_key")),
    meta_app_id: await getMetaAppId(),
    meta_app_secret_set: !!(await getSetting("meta_app_secret")),
  })
}

export async function POST(req: NextRequest) {
  return PUT(req)
}

export async function PUT(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const body = await req.json()
    if (body.anthropic_api_key) await setSetting("anthropic_api_key", body.anthropic_api_key)
    if (body.meta_app_id) await setSetting("meta_app_id", body.meta_app_id)
    if (body.meta_app_secret) await setSetting("meta_app_secret", body.meta_app_secret)
    return Response.json({ success: true })
  } catch (e: any) {
    console.error("settings/platform error:", e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
