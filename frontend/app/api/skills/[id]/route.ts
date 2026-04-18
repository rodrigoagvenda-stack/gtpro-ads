import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant } from "@/lib/server/auth"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenant(req)
  if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const body = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from("skills")
    .update({ name: body.name, prompt: body.prompt, icon: body.icon, color: body.color, active: body.active })
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenant_id) // só pode editar as próprias
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const ctx = await getTenant(req)
  if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const supabase = createServiceClient()
  await supabase
    .from("skills")
    .delete()
    .eq("id", params.id)
    .eq("tenant_id", ctx.tenant_id)

  return Response.json({ success: true })
}
