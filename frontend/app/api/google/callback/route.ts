import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import {
  exchangeGoogleCode,
  listAccessibleCustomers,
  getCustomerInfo,
  saveGoogleConnections,
} from "@/lib/server/google-ads"

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const origin      = process.env.NEXT_PUBLIC_APP_URL ?? "https://gtpro.vendai.pro"
  const redirectUri = `${origin}/api/google/callback`
  const code  = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  if (error) return Response.redirect(`${origin}/configuracoes?google=denied`)
  if (!code || !state) return Response.redirect(`${origin}/configuracoes?google=error`)

  const supabase = createServiceClient()
  const { data: oauthState } = await supabase
    .from("oauth_states")
    .select("tenant_id, expires_at")
    .eq("state", state)
    .eq("provider", "google")
    .single()

  if (!oauthState || new Date(oauthState.expires_at) < new Date())
    return Response.redirect(`${origin}/configuracoes?google=expired`)

  await supabase.from("oauth_states").delete().eq("state", state)

  try {
    const tokens = await exchangeGoogleCode(code, redirectUri)

    // Discover all accessible customers
    const customers = await listAccessibleCustomers(tokens.access_token)
    console.log(`[google/callback] accessible customers: ${customers.length}`)
    if (!customers.length) throw new Error("Nenhuma conta Google Ads acessível encontrada")

    // Find MCC (manager account) if any
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

    // Save non-manager client accounts (or all if no manager found)
    const clientAccounts = customerDetails.filter(c => !c.isManager)
    const toSave = clientAccounts.length ? clientAccounts : customerDetails

    await saveGoogleConnections(oauthState.tenant_id, tokens.access_token, tokens.refresh_token, toSave, managerCustomerId)
    console.log(`[google/callback] saved ${toSave.length} accounts, manager=${managerCustomerId}`)

    return Response.redirect(`${origin}/configuracoes?google=connected`)
  } catch (e: any) {
    console.error("[google/callback] error:", e)
    return Response.redirect(`${origin}/configuracoes?google=error&msg=${encodeURIComponent(e.message)}`)
  }
}
