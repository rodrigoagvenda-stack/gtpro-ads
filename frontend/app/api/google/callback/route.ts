import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import {
  exchangeGoogleCode,
  listAccessibleCustomers,
  getCustomerInfo,
  saveGoogleConnections,
} from "@/lib/server/google-ads"

// Format a raw customer ID as Google displays it: XXX-XXX-XXXX
function fmtId(id: string): string {
  const n = id.replace(/\D/g, "")
  if (n.length === 10) return `${n.slice(0, 3)}-${n.slice(3, 6)}-${n.slice(6)}`
  return n
}

export async function GET(req: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://gtpro.vendai.pro"
  const redirectUri = `${origin}/api/google/callback`

  try {
    const { searchParams } = req.nextUrl
    const code  = searchParams.get("code")
    const state = searchParams.get("state")
    const error = searchParams.get("error")

    if (error) return Response.redirect(`${origin}/configuracoes?google=denied`, 302)
    if (!code || !state) return Response.redirect(`${origin}/configuracoes?google=error&msg=missing_params`, 302)

    const supabase = createServiceClient()

    // Try with provider filter first (requires migration 022)
    let tenantId: string
    const { data: oauthState, error: dbErr } = await supabase
      .from("oauth_states")
      .select("tenant_id, expires_at")
      .eq("state", state)
      .eq("provider", "google")
      .single()

    if (oauthState && new Date(oauthState.expires_at) >= new Date()) {
      tenantId = oauthState.tenant_id as string
    } else {
      if (dbErr) console.warn("[google/callback] provider filter failed, trying without:", dbErr.message)
      const { data: fallback } = await supabase
        .from("oauth_states")
        .select("tenant_id, expires_at")
        .eq("state", state)
        .single()
      if (!fallback || new Date(fallback.expires_at) < new Date())
        return Response.redirect(`${origin}/configuracoes?google=expired`, 302)
      tenantId = fallback.tenant_id as string
    }

    await supabase.from("oauth_states").delete().eq("state", state)

    const tokens = await exchangeGoogleCode(code, redirectUri)

    const customers = await listAccessibleCustomers(tokens.access_token)
    console.log(`[google/callback] accessible customers: ${customers.length}`)
    if (!customers.length) throw new Error("Nenhuma conta Google Ads acessível encontrada")

    type CDetail = { id: string; name: string; currencyCode: string; isManager: boolean }
    const customerDetails: CDetail[] = []
    let managerCustomerId: string | undefined
    const failedIds: string[] = []

    // Pass 1 — try each account individually (finds MCC which can use itself as login)
    for (const c of customers) {
      try {
        const info = await getCustomerInfo(c.id, tokens.access_token)
        if (info) {
          if (info.manager) managerCustomerId = c.id
          customerDetails.push({
            id:           c.id,
            name:         info.descriptiveName || fmtId(c.id),
            currencyCode: info.currencyCode ?? "BRL",
            isManager:    !!info.manager,
          })
        } else {
          failedIds.push(c.id)
        }
      } catch {
        failedIds.push(c.id)
      }
    }

    // Pass 2 — retry sub-accounts using the identified MCC as login-customer-id
    if (failedIds.length > 0) {
      console.log(`[google/callback] pass 2: ${failedIds.length} accounts, manager=${managerCustomerId}`)
      for (const id of failedIds) {
        try {
          const info = await getCustomerInfo(id, tokens.access_token, managerCustomerId)
          customerDetails.push({
            id,
            name:         info?.descriptiveName || fmtId(id),
            currencyCode: info?.currencyCode ?? "BRL",
            isManager:    false,
          })
        } catch {
          customerDetails.push({ id, name: fmtId(id), currencyCode: "BRL", isManager: false })
        }
      }
    }

    // Save client accounts only; if none identified as manager, save all
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
