import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { cookies } from "next/headers"

// GET /api/debug/tenant — acessível direto no browser (lê cookie de sessão)
export async function GET(req: NextRequest) {
  const supabase = createServiceClient()

  // Tenta pegar token do cookie de sessão do Supabase
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()
  const sessionCookie = allCookies.find(c => c.name.includes("auth-token") || c.name.includes("access_token"))

  // Tenta também pelo header Authorization
  const auth = req.headers.get("authorization")
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : sessionCookie?.value

  if (!token) {
    return Response.json({ error: "Sem sessão ativa. Faça login primeiro." }, { status: 401 })
  }

  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) {
    return Response.json({ error: "Token inválido ou expirado." }, { status: 401 })
  }

  const { data: memberRow } = await supabase
    .from("tenant_members")
    .select("id, tenant_id, role")
    .eq("id", user.id)
    .single()

  const tenantId = user.app_metadata?.tenant_id ?? memberRow?.tenant_id ?? null

  const { data: metaRows } = await supabase
    .from("meta_connections")
    .select("id, tenant_id, ad_account_id, active, is_active, created_at")
    .eq("tenant_id", tenantId ?? "")

  // Busca também pelo user.id diretamente (contas antigas)
  const { data: metaByUserId } = await supabase
    .from("meta_connections")
    .select("id, tenant_id, ad_account_id, active, is_active, created_at")
    .eq("tenant_id", user.id)

  return Response.json({
    user_id: user.id,
    user_email: user.email,
    app_metadata_tenant_id: user.app_metadata?.tenant_id ?? null,
    tenant_members_row: memberRow ?? null,
    resolved_tenant_id: tenantId,
    meta_connections_for_resolved_tenant: metaRows ?? [],
    meta_connections_for_user_id: metaByUserId ?? [],
    note: "Se meta_connections_for_user_id tiver dados mas meta_connections_for_resolved_tenant estiver vazio, o tenant_id está errado",
  })
}
