import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getMetaAppId } from "@/lib/server/platform"
import { createServiceClient } from "@/lib/server/supabase"
import { randomBytes } from "crypto"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const appId = await getMetaAppId()
  if (!appId) return Response.json({ error: "Meta App ID não configurado em Configurações" }, { status: 400 })

  const state = randomBytes(16).toString("hex")
  const supabase = createServiceClient()
  await supabase.from("oauth_states").insert({
    state,
    tenant_id: tenant.tenant_id,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  })

  const redirectUri = `${req.nextUrl.origin}/api/meta/callback`
  const scope = "ads_management,ads_read,business_management,read_insights,pages_show_list,pages_read_engagement,instagram_basic"
  const url = `https://www.facebook.com/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${state}&response_type=code`

  return Response.json({ url })
}
