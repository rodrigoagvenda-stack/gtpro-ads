import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant } from "@/lib/server/auth"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenant(req)
  if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from("skills")
    .update({ name: body.name, prompt: body.prompt, icon: body.icon, color: body.color, active: body.active })
    .eq("id", id)
    .eq("tenant_id", ctx.tenant_id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getTenant(req)
  if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const { id } = await params
  const supabase = createServiceClient()
  await supabase.from("skills").delete().eq("id", id).eq("tenant_id", ctx.tenant_id)

  return Response.json({ success: true })
}
