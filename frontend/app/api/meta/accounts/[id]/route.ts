import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const { id } = await params
  const body = await req.json()
  const supabase = createServiceClient()

  const update: Record<string, unknown> = {}
  if ("name"     in body) update.name     = body.name
  if ("pixel_id" in body) update.pixel_id = body.pixel_id ?? null

  if (!Object.keys(update).length) return Response.json({ error: "Nada para atualizar" }, { status: 400 })

  await supabase
    .from("meta_connections")
    .update(update)
    .eq("id", id)
    .eq("tenant_id", tenant.tenant_id)

  return Response.json({ success: true })
}
