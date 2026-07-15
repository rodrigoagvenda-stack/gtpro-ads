import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getSetting, setSetting, getMetaAppId, getGoogleClientId } from "@/lib/server/platform"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  return Response.json({
    anthropic_api_key_set:    !!(await getSetting("anthropic_api_key")),
    meta_app_id:               await getMetaAppId(),
    meta_app_secret_set:      !!(await getSetting("meta_app_secret")),
    google_client_id:          await getGoogleClientId(),
    google_client_secret_set: !!(await getSetting("google_client_secret")),
    google_developer_token_set: !!(await getSetting("google_developer_token")),
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
    if (body.anthropic_api_key)     await setSetting("anthropic_api_key",     body.anthropic_api_key)
    if (body.meta_app_id)           await setSetting("meta_app_id",           body.meta_app_id)
    if (body.meta_app_secret)       await setSetting("meta_app_secret",       body.meta_app_secret)
    if (body.google_client_id)      await setSetting("google_client_id",      body.google_client_id)
    if (body.google_client_secret)  await setSetting("google_client_secret",  body.google_client_secret)
    if (body.google_developer_token) await setSetting("google_developer_token", body.google_developer_token)
    return Response.json({ success: true })
  } catch (e: any) {
    console.error("settings/platform error:", e)
    return Response.json({ error: e.message }, { status: 500 })
  }
}
