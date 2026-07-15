import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getGoogleOAuthUrl } from "@/lib/server/google-ads"
import { createServiceClient } from "@/lib/server/supabase"
import { randomBytes } from "crypto"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://gtpro.vendai.pro"
  const redirectUri = `${origin}/api/google/callback`

  try {
    const state = randomBytes(16).toString("hex")
    const supabase = createServiceClient()
    await supabase.from("oauth_states").insert({
      state,
      tenant_id: tenant.tenant_id,
      provider:  "google",
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    })

    const url = await getGoogleOAuthUrl(state, redirectUri)
    return Response.json({ url })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
