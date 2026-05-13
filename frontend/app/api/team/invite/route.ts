import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant, unauthorized } from "@/lib/server/auth"

const MANAGER_ROLES = ["owner", "admin", "super_admin"]

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

// POST /api/team/invite — owner ou admin cria convite
export async function POST(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx || ctx.auth_type === "api_key") return unauthorized()

  const supabase = createServiceClient()

  await resolveCallerRole(supabase, ctx.user_id!, ctx.tenant_id)

  // Usa ctx.tenant_id diretamente — é o mesmo valor usado em meta_connections, agent_configs, etc.
  const tenantId = ctx.tenant_id

  const { email, role = "member" } = await req.json()

  if (!email?.trim()) {
    return Response.json({ error: "E-mail obrigatório." }, { status: 400 })
  }
  if (!["admin", "member"].includes(role)) {
    return Response.json({ error: "Role inválido." }, { status: 400 })
  }

  // Verifica se e-mail já é membro no tenant
  const { data: existingUser } = await supabase.auth.admin.listUsers()
  const userWithEmail = existingUser?.users?.find(
    u => u.email === email.trim().toLowerCase(),
  )
  if (userWithEmail) {
    const { data: member } = await supabase
      .from("tenant_members")
      .select("id")
      .eq("id", userWithEmail.id)
      .eq("tenant_id", tenantId)
      .single()
    if (member) {
      return Response.json({ error: "Este e-mail já é membro desta empresa." }, { status: 409 })
    }
  }

  // Cancela convites pendentes para o mesmo e-mail no tenant
  await supabase
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("email", email.trim().toLowerCase())
    .is("accepted_at", null)

  // Cria novo convite
  const { data: invite, error } = await supabase
    .from("invites")
    .insert({
      tenant_id: tenantId,
      email: email.trim().toLowerCase(),
      role,
      created_by: ctx.user_id,
    })
    .select("token")
    .single()

  if (error || !invite) {
    console.error("[invite] insert error:", error?.message)
    return Response.json({ error: `Erro ao criar convite: ${error?.message}` }, { status: 500 })
  }

  const baseUrl = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? ""
  const invite_url = `${baseUrl}/convite/${invite.token}`

  return Response.json({ invite_url, token: invite.token })
}
