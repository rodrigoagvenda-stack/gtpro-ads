import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant, unauthorized } from "@/lib/server/auth"

// POST /api/team/invite — owner ou admin cria convite
export async function POST(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx || ctx.auth_type === "api_key") return unauthorized()

  const supabase = createServiceClient()

  // Verifica role do solicitante
  const { data: me } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("id", ctx.user_id)
    .single()

  if (!me || !["owner", "admin"].includes(me.role)) {
    return Response.json({ error: "Apenas owners e admins podem convidar membros." }, { status: 403 })
  }

  const { email, role = "member" } = await req.json()

  if (!email?.trim()) {
    return Response.json({ error: "E-mail obrigatório." }, { status: 400 })
  }
  if (!["admin", "member"].includes(role)) {
    return Response.json({ error: "Role inválido." }, { status: 400 })
  }

  // Verifica se e-mail já é membro
  const { data: existingUser } = await supabase.auth.admin.listUsers()
  const userWithEmail = existingUser?.users?.find(u => u.email === email.trim().toLowerCase())
  if (userWithEmail) {
    const { data: member } = await supabase
      .from("tenant_members")
      .select("id")
      .eq("id", userWithEmail.id)
      .single()
    if (member) {
      return Response.json({ error: "Este e-mail já possui uma conta no GTPRO." }, { status: 409 })
    }
  }

  // Cancela convites pendentes para o mesmo e-mail no tenant
  await supabase
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("tenant_id", ctx.tenant_id)
    .eq("email", email.trim().toLowerCase())
    .is("accepted_at", null)

  // Cria novo convite
  const { data: invite, error } = await supabase
    .from("invites")
    .insert({
      tenant_id: ctx.tenant_id,
      email: email.trim().toLowerCase(),
      role,
      created_by: ctx.user_id,
    })
    .select("token")
    .single()

  if (error || !invite) {
    console.error("[invite] insert error:", error?.message)
    return Response.json({ error: "Erro ao criar convite." }, { status: 500 })
  }

  const baseUrl = req.headers.get("origin") ?? process.env.NEXT_PUBLIC_APP_URL ?? ""
  const invite_url = `${baseUrl}/convite/${invite.token}`

  return Response.json({ invite_url, token: invite.token })
}
