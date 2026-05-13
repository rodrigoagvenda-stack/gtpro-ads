import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { cookies } from "next/headers"

// GET /api/debug/tenant — acessível direto no browser (lê cookie de sessão Supabase)
export async function GET(req: NextRequest) {
  const supabase = createServiceClient()

  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  // Supabase guarda o token em sb-<ref>-auth-token como JSON
  let token: string | null = null
  for (const c of allCookies) {
    if (c.name.includes("auth-token")) {
      try {
        const parsed = JSON.parse(c.value)
        if (parsed?.access_token) { token = parsed.access_token; break }
      } catch {
        // pode ser o token direto
        if (c.value.startsWith("eyJ")) { token = c.value; break }
      }
    }
  }

  // Fallback: Authorization header
  const auth = req.headers.get("authorization")
  if (!token && auth?.startsWith("Bearer ")) token = auth.slice(7)

  if (!token) {
    return Response.json({
      error: "Sem token encontrado.",
      cookies_found: allCookies.map(c => c.name),
    }, { status: 401 })
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser(token)
  if (!user) {
    return Response.json({
      error: "Token inválido.",
      token_prefix: token.slice(0, 20),
      supabase_error: userError?.message,
    }, { status: 401 })
  }

  const { data: memberRow } = await supabase
    .from("tenant_members")
    .select("id, tenant_id, role")
    .eq("id", user.id)
    .single()

  const tenantId = user.app_metadata?.tenant_id ?? memberRow?.tenant_id ?? null

  const { data: metaByTenant } = await supabase
    .from("meta_connections")
    .select("id, tenant_id, ad_account_id, active, is_active")
    .eq("tenant_id", tenantId ?? "")

  const { data: metaByUserId } = await supabase
    .from("meta_connections")
    .select("id, tenant_id, ad_account_id, active, is_active")
    .eq("tenant_id", user.id)

  return Response.json({
    user_id: user.id,
    user_email: user.email,
    app_metadata_tenant_id: user.app_metadata?.tenant_id ?? null,
    tenant_members_row: memberRow ?? null,
    resolved_tenant_id: tenantId,
    meta_connections_for_resolved_tenant: metaByTenant ?? [],
    meta_connections_for_user_id: metaByUserId ?? [],
  })
}
