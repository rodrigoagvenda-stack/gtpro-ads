import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()

    if (!name?.trim() || !email?.trim() || !password) {
      return Response.json({ error: "Preencha todos os campos." }, { status: 400 })
    }
    if (password.length < 6) {
      return Response.json({ error: "A senha deve ter no mínimo 6 caracteres." }, { status: 400 })
    }

    const supabase = createServiceClient()

    // Create auth user via admin API (email_confirm: true = no verification email)
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })

    if (authError) {
      const msg = authError.message.toLowerCase().includes("already registered")
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
      await supabase.auth.admin.deleteUser(userId)
      console.error("[register] tenant insert error:", tenantError?.message)
      return Response.json({ error: "Erro ao criar conta. Tente novamente." }, { status: 500 })
    }

    // Link user → tenant
    await supabase.from("tenant_members").insert({
      id: userId,
      tenant_id: tenant.id,
      role: "owner",
    })

    // Default agent config
    await supabase.from("agent_configs").insert({
      tenant_id: tenant.id,
      objetivo_principal: "LEADS",
      roas_minimo: 2,
      cpl_maximo: 50,
      modo_supervisionado: true,
      user_name: name.trim(),
    })

    // Set tenant_id in JWT app_metadata
    await supabase.auth.admin.updateUserById(userId, {
      app_metadata: { tenant_id: tenant.id },
    })

    return Response.json({ ok: true })
  } catch (e: any) {
    console.error("[register] unexpected error:", e.message)
    return Response.json({ error: "Erro interno. Tente novamente." }, { status: 500 })
  }
}
