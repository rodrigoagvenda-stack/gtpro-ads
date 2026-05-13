import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant, unauthorized } from "@/lib/server/auth"

type Params = { params: Promise<{ userId: string }> }

async function getCallerRole(supabase: ReturnType<typeof createServiceClient>, userId: string) {
  const { data } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("id", userId)
    .single()
  return data?.role ?? null
}

// PATCH /api/team/members/[userId] — atualiza role (owner only)
export async function PATCH(req: NextRequest, { params }: Params) {
  const ctx = await getTenant(req)
  if (!ctx || ctx.auth_type === "api_key") return unauthorized()

  const supabase = createServiceClient()
  const callerRole = await getCallerRole(supabase, ctx.user_id!)

  if (callerRole !== "owner") {
    return Response.json({ error: "Apenas o owner pode alterar roles." }, { status: 403 })
  }

  const { userId } = await params
  if (userId === ctx.user_id) {
    return Response.json({ error: "Não é possível alterar seu próprio role." }, { status: 400 })
  }

  const { role } = await req.json()
  if (!["admin", "member"].includes(role)) {
    return Response.json({ error: "Role inválido." }, { status: 400 })
  }

  const { error } = await supabase
    .from("tenant_members")
    .update({ role })
    .eq("id", userId)
    .eq("tenant_id", ctx.tenant_id)

  if (error) {
    return Response.json({ error: "Erro ao atualizar role." }, { status: 500 })
  }

  return Response.json({ ok: true })
}

// DELETE /api/team/members/[userId] — remove membro (owner ou admin)
export async function DELETE(req: NextRequest, { params }: Params) {
  const ctx = await getTenant(req)
  if (!ctx || ctx.auth_type === "api_key") return unauthorized()

  const supabase = createServiceClient()
  const callerRole = await getCallerRole(supabase, ctx.user_id!)

  if (!callerRole || !["owner", "admin", "super_admin"].includes(callerRole)) {
    return Response.json({ error: "Sem permissão para remover membros." }, { status: 403 })
  }

  const { userId } = await params
  if (userId === ctx.user_id) {
    return Response.json({ error: "Não é possível remover a si mesmo." }, { status: 400 })
  }

  // Admin não pode remover owner
  const { data: target } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("id", userId)
    .eq("tenant_id", ctx.tenant_id)
    .single()

  if (!target) {
    return Response.json({ error: "Membro não encontrado." }, { status: 404 })
  }
  if (target.role === "owner" && callerRole !== "owner") {
    return Response.json({ error: "Apenas o owner pode remover outro owner." }, { status: 403 })
  }

  await supabase.from("tenant_members").delete().eq("id", userId).eq("tenant_id", ctx.tenant_id)

  return Response.json({ ok: true })
}
