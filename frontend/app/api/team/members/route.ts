import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant, unauthorized } from "@/lib/server/auth"

// GET /api/team/members — lista membros do tenant
export async function GET(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx || ctx.auth_type === "api_key") return unauthorized()

  const supabase = createServiceClient()

  // Busca role do caller diretamente pelo user_id (não depende de tenant_id)
  const { data: callerRow } = await supabase
    .from("tenant_members")
    .select("role, tenant_id")
    .eq("id", ctx.user_id!)
    .single()

  // Se o caller não tem registro em tenant_members, usa tenant_id do JWT
  const tenantId = callerRow?.tenant_id ?? ctx.tenant_id
  const my_role = callerRow?.role ?? "owner"

  const { data: members, error } = await supabase
    .from("tenant_members")
    .select("id, role, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at")

  if (error) {
    return Response.json({ error: `Erro ao buscar membros: ${error.message}` }, { status: 500 })
  }

  // Busca emails dos usuários (cada membro individualmente para evitar problemas com listUsers)
  const enriched = await Promise.all(
    members.map(async m => {
      const { data } = await supabase.auth.admin.getUserById(m.id)
      return {
        id: m.id,
        role: m.role,
        created_at: m.created_at,
        email: data?.user?.email ?? "",
        name: (data?.user?.user_metadata?.name as string) ?? data?.user?.email ?? "",
      }
    })
  )

  // Convites pendentes
  let pendingInvites: unknown[] = []
  try {
    const { data } = await supabase
      .from("invites")
      .select("id, email, role, expires_at, created_at")
      .eq("tenant_id", tenantId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
    pendingInvites = data ?? []
  } catch {}

  return Response.json({
    members: enriched,
    pending_invites: pendingInvites,
    my_id: ctx.user_id,
    my_role,
    debug_tenant_id: tenantId,
  })
}
