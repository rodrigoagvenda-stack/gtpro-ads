import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant, unauthorized } from "@/lib/server/auth"

// GET /api/team/members — lista membros do tenant
export async function GET(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx || ctx.auth_type === "api_key") return unauthorized()

  const supabase = createServiceClient()

  const { data: members, error } = await supabase
    .from("tenant_members")
    .select("id, role, created_at")
    .eq("tenant_id", ctx.tenant_id)
    .order("created_at")

  if (error) {
    return Response.json({ error: "Erro ao buscar membros." }, { status: 500 })
  }

  // Busca emails dos usuários via auth.admin
  const { data: usersData } = await supabase.auth.admin.listUsers()
  const usersMap = new Map(usersData?.users?.map(u => [u.id, u]) ?? [])

  const result = members.map(m => {
    const u = usersMap.get(m.id)
    return {
      id: m.id,
      role: m.role,
      created_at: m.created_at,
      email: u?.email ?? "",
      name: (u?.user_metadata?.name as string) ?? u?.email ?? "",
    }
  })

  // Role do usuário atual
  const myMember = result.find(m => m.id === ctx.user_id)
  const my_role = myMember?.role ?? "member"

  // Convites pendentes (tabela pode não existir ainda se migration não foi aplicada)
  let pendingInvites: unknown[] = []
  try {
    const { data } = await supabase
      .from("invites")
      .select("id, email, role, expires_at, created_at")
      .eq("tenant_id", ctx.tenant_id)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
    pendingInvites = data ?? []
  } catch {}

  return Response.json({
    members: result,
    pending_invites: pendingInvites,
    my_id: ctx.user_id,
    my_role,
  })
}
