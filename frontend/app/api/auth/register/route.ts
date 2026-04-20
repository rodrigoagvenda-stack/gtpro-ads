import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json()

  if (!name?.trim() || !email?.trim() || !password) {
    return Response.json({ error: "Preencha todos os campos." }, { status: 400 })
  }
  if (password.length < 6) {
    return Response.json({ error: "A senha deve ter no mínimo 6 caracteres." }, { status: 400 })
  }

  const supabase = createServiceClient()

  // Create auth user via admin API (bypasses email confirmation)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })

  if (authError) {
    const msg = authError.message.includes("already registered")
      ? "Este e-mail já está cadastrado."
      : authError.message
    return Response.json({ error: msg }, { status: 400 })
  }

  const userId = authData.user.id

  // Create tenant
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({ nome: name.trim(), segmento: "agencia" })
    .select("id")
    .single()

  if (tenantError || !tenant) {
    await admin.auth.admin.deleteUser(userId)
    return Response.json({ error: "Erro ao criar conta. Tente novamente." }, { status: 500 })
  }

  // Link user to tenant
  await supabase.from("tenant_members").insert({
    id: userId,
    tenant_id: tenant.id,
    role: "owner",
  })

  // Create default agent_configs
  await supabase.from("agent_configs").insert({
    tenant_id: tenant.id,
    objetivo_principal: "LEADS",
    roas_minimo: 2,
    cpl_maximo: 50,
    modo_supervisionado: true,
    user_name: name.trim(),
  })

  // Update auth user app_metadata with tenant_id (required for JWT auth)
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { tenant_id: tenant.id },
  })

  return Response.json({ ok: true })
}
