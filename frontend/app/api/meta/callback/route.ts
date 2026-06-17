import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { exchangeCodeForToken, getLongLivedToken, getAdAccounts, saveMetaConnection } from "@/lib/server/meta-ads"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) return Response.redirect(`${origin}/configuracoes?meta=denied`)
  if (!code || !state) return Response.redirect(`${origin}/configuracoes?meta=error`)

  const supabase = createServiceClient()

  const { data: oauthState } = await supabase
    .from("oauth_states")
    .select("tenant_id, expires_at")
    .eq("state", state)
    .single()

  if (!oauthState || new Date(oauthState.expires_at) < new Date()) {
    return Response.redirect(`${origin}/configuracoes?meta=expired`)
  }

  await supabase.from("oauth_states").delete().eq("state", state)

  try {
    const redirectUri = `${origin}/api/meta/callback`
    const tokenData = await exchangeCodeForToken(code, redirectUri)
    const longToken = await getLongLivedToken(tokenData.access_token)

    const accounts = await getAdAccounts(longToken.access_token)
    if (!accounts.length) throw new Error("Nenhuma conta de anúncios encontrada")

    const first = accounts[0]
    // Meta returns id as "act_XXXXXXX" — strip prefix before storing (code adds act_ on use)
    const accountId = (first.id ?? first.account_id ?? "").replace(/^act_/, "")
    await saveMetaConnection(oauthState.tenant_id, longToken.access_token, accountId)

    return Response.redirect(`${origin}/configuracoes?meta=connected&account=${encodeURIComponent(first.name ?? accountId)}`)
  } catch (e: any) {
    console.error("meta/callback error:", e)
    return Response.redirect(`${origin}/configuracoes?meta=error&msg=${encodeURIComponent(e.message)}`)
  }
}
