import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import {
  exchangeGoogleCode,
  listAccessibleCustomers,
  getCustomerInfo,
  getCustomerClientNames,
  saveGoogleConnections,
} from "@/lib/server/google-ads"
import { listGA4Properties, saveGA4Connections } from "@/lib/server/ga4"
import { listGTMContainers, saveGTMConnections } from "@/lib/server/gtm"

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

    // GA4 é salvo independente do resultado do Google Ads abaixo — um tenant pode ter
    // só Analytics conectado, sem nenhuma conta de anúncios acessível.
    try {
      const ga4Properties = await listGA4Properties(tokens.access_token)
      if (ga4Properties.length) {
        await saveGA4Connections(tenantId, tokens.access_token, tokens.refresh_token, ga4Properties)
        console.log(`[google/callback] GA4: ${ga4Properties.length} propriedades salvas`)
      } else {
        console.log("[google/callback] GA4: nenhuma propriedade acessível")
      }
    } catch (e: any) {
      console.warn("[google/callback] GA4 falhou (não bloqueia Google Ads):", e.message)
    }

    // GTM idem — independente do resultado do Google Ads.
    try {
      const gtmContainers = await listGTMContainers(tokens.access_token)
      if (gtmContainers.length) {
        await saveGTMConnections(tenantId, tokens.access_token, tokens.refresh_token, gtmContainers)
        console.log(`[google/callback] GTM: ${gtmContainers.length} containers salvos`)
      } else {
        console.log("[google/callback] GTM: nenhum container acessível")
      }
    } catch (e: any) {
      console.warn("[google/callback] GTM falhou (não bloqueia Google Ads):", e.message)
    }

    const customers = await listAccessibleCustomers(tokens.access_token)
    console.log(`[google/callback] accessible customers: ${customers.length}`)
    if (!customers.length) throw new Error("Nenhuma conta Google Ads acessível encontrada")

    type CDetail = { id: string; name: string; currencyCode: string; isManager: boolean }
    const customerDetails: CDetail[] = []
    let managerCustomerId: string | undefined

    // Preferred method: query customer_client from each accessible account — the one(s)
    // that ARE a manager return descriptive_name for every child in the hierarchy in one
    // shot, instead of guessing login-customer-id per account (which was failing for
    // every sub-account and silently falling back to the raw numeric ID as "name").
    const nameMap = new Map<string, { name: string; currencyCode: string; isManager: boolean }>()
    for (const c of customers) {
      const clientMap = await getCustomerClientNames(c.id, tokens.access_token)
      if (clientMap.size > 0) {
        for (const [id, info] of clientMap) nameMap.set(id, info)
        if (!managerCustomerId) managerCustomerId = c.id
      }
    }
    console.log(`[google/callback] customer_client hierarchy resolved ${nameMap.size} names, manager=${managerCustomerId ?? "none found"}`)

    // nameMap already covers the FULL hierarchy under each manager found — not just the
    // accounts directly accessible to this login. Iterating only `customers` here was the
    // bug: any sub-account present in the hierarchy but not directly accessible got silently
    // dropped, even though customer_client had already resolved its name correctly.
    const failedIds: string[] = []
    for (const [id, found] of nameMap) {
      customerDetails.push({ id, name: found.name || fmtId(id), currencyCode: found.currencyCode, isManager: found.isManager })
    }
    for (const c of customers) {
      if (!nameMap.has(c.id)) failedIds.push(c.id)
    }

    // Fallback — per-account lookup for anything the hierarchy query didn't cover
    if (failedIds.length > 0) {
      console.log(`[google/callback] fallback lookup: ${failedIds.length} accounts, manager=${managerCustomerId}`)
      for (const id of failedIds) {
        try {
          const info = await getCustomerInfo(id, tokens.access_token, managerCustomerId)
          customerDetails.push({
            id,
            name:         info?.descriptiveName || fmtId(id),
            currencyCode: info?.currencyCode ?? "BRL",
            isManager:    !!info?.manager,
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
