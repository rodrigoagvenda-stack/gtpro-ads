import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant, unauthorized } from "@/lib/server/auth"

async function resolveCallerRole(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  tenantId: string,
): Promise<{ role: string; tenant_id: string }> {
  const { data } = await supabase
    .from("tenant_members")
    .select("role, tenant_id")
    .eq("id", userId)
    .single()

  if (data) return data

  // Usuário tem JWT válido mas não está em tenant_members — auto-inserir como owner
  await supabase.from("tenant_members").insert({
    id: userId,
    tenant_id: tenantId,
    role: "owner",
  })

  return { role: "owner", tenant_id: tenantId }
}

// GET /api/team/members — lista membros do tenant
export async function GET(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx || ctx.auth_type === "api_key") return unauthorized()

  const supabase = createServiceClient()

  const caller = await resolveCallerRole(supabase, ctx.user_id!, ctx.tenant_id)
  const tenantId = caller.tenant_id
  const my_role = caller.role

  const { data: members, error } = await supabase
    .from("tenant_members")
    .select("id, role, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at")

  if (error) {
    return Response.json({ error: `Erro ao buscar membros: ${error.message}` }, { status: 500 })
  }

  // Busca email/nome de cada membro individualmente
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
  })
}
