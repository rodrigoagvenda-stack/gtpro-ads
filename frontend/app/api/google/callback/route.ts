import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import {
  exchangeGoogleCode,
  listAccessibleCustomers,
  getCustomerInfo,
  saveGoogleConnections,
} from "@/lib/server/google-ads"

export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://gtpro.vendai.pro"
  const redirectUri = `${origin}/api/google/callback`

  // Top-level catch so no unhandled rejection can crash the process
  try {
    const { searchParams } = req.nextUrl
    const code  = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    if (error) return Response.redirect(`${origin}/configuracoes?google=denied`, 302)
    if (!code || !state) return Response.redirect(`${origin}/configuracoes?google=error&msg=missing_params`, 302)

    const supabase = createServiceClient()

    // Try with provider filter first (requires migration 022)
    let tenantId: string | null = null
    const { data: oauthState, error: dbErr } = await supabase
      .from("oauth_states")
      .select("tenant_id, expires_at")
      .eq("state", state)
      .eq("provider", "google")
      .single()

    if (oauthState && new Date(oauthState.expires_at) >= new Date()) {
      tenantId = oauthState.tenant_id
    } else {
      // Fallback: provider column may not exist yet
      if (dbErr) console.warn("[google/callback] provider filter failed, trying without:", dbErr.message)
      const { data: fallback } = await supabase
        .from("oauth_states")
        .select("tenant_id, expires_at")
        .eq("state", state)
        .single()
      if (!fallback || new Date(fallback.expires_at) < new Date())
        return Response.redirect(`${origin}/configuracoes?google=expired`, 302)
      tenantId = fallback.tenant_id
    }

    await supabase.from("oauth_states").delete().eq("state", state)

    const tokens = await exchangeGoogleCode(code, redirectUri)

    const customers = await listAccessibleCustomers(tokens.access_token)
    console.log(`[google/callback] accessible customers: ${customers.length}`)
    if (!customers.length) throw new Error("Nenhuma conta Google Ads acessível encontrada")

    let managerCustomerId: string | undefined
    const customerDetails: { id: string; name: string; currencyCode: string; isManager: boolean }[] = []

    for (const c of customers) {
      try {
        const info = await getCustomerInfo(c.id, tokens.access_token, c.id)
        if (info) {
          if (info.manager) managerCustomerId = c.id
          customerDetails.push({
            id:           c.id,
            name:         info.descriptiveName ?? `Conta ${c.id}`,
            currencyCode: info.currencyCode ?? "BRL",
            isManager:    !!info.manager,
          })
        }
      } catch (e: any) {
        console.warn(`[google/callback] could not get info for ${c.id}:`, e.message)
        customerDetails.push({ id: c.id, name: `Conta ${c.id}`, currencyCode: "BRL", isManager: false })
      }
    }

    const clientAccounts = customerDetails.filter(c => !c.isManager)
    const toSave = clientAccounts.length ? clientAccounts : customerDetails

    await saveGoogleConnections(tenantId, tokens.access_token, tokens.refresh_token, toSave, managerCustomerId)
    console.log(`[google/callback] saved ${toSave.length} accounts, manager=${managerCustomerId}`)

    return Response.redirect(`${origin}/configuracoes?google=connected`, 302)
  } catch (e: any) {
    console.error("[google/callback] error:", e)
    return Response.redirect(
      `${origin}/configuracoes?google=error&msg=${encodeURIComponent((e as Error).message ?? "unknown")}`,
      302,
    )
  }
}
