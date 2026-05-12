import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"

// POST /api/team/join — público, cria usuário e entra na empresa via convite
export async function POST(req: NextRequest) {
  const { token, name, password } = await req.json()

  if (!token || !name?.trim() || !password) {
    return Response.json({ error: "Preencha todos os campos." }, { status: 400 })
  }
  if (password.length < 6) {
    return Response.json({ error: "A senha deve ter no mínimo 6 caracteres." }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Busca e valida o convite (sem RLS, service role)
  const { data: invite } = await supabase
    .from("invites")
    .select("id, email, role, tenant_id, expires_at, accepted_at")
    .eq("token", token)
    .single()

  if (!invite) {
    return Response.json({ error: "Convite não encontrado." }, { status: 404 })
  }
  if (invite.accepted_at) {
    return Response.json({ error: "Este convite já foi utilizado." }, { status: 410 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return Response.json({ error: "Este convite expirou." }, { status: 410 })
  }

  // Cria o usuário
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
    user_metadata: { name: name.trim() },
  })

  if (authError) {
    const msg = authError.message.toLowerCase().includes("already registered")
      ? "Este e-mail já possui uma conta."
      : authError.message
    return Response.json({ error: msg }, { status: 400 })
  }

  const userId = authData.user.id

  // Define tenant_id no JWT app_metadata
  await supabase.auth.admin.updateUserById(userId, {
    app_metadata: { tenant_id: invite.tenant_id },
  })

  // Adiciona à equipe
  const { error: memberError } = await supabase.from("tenant_members").insert({
    id: userId,
    tenant_id: invite.tenant_id,
    role: invite.role,
  })

  if (memberError) {
    await supabase.auth.admin.deleteUser(userId)
    console.error("[join] member insert error:", memberError.message)
    return Response.json({ error: "Erro ao entrar na empresa. Tente novamente." }, { status: 500 })
  }

  // Marca convite como aceito
  await supabase
    .from("invites")
    .update({ accepted_at: new Date().toISOString() })
    .eq("id", invite.id)

  return Response.json({ ok: true, email: invite.email })
}
