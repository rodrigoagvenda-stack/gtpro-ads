import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const updates: Record<string, unknown> = {}
  if (typeof body.name === "string") updates.name = body.name
  if (Object.prototype.hasOwnProperty.call(body, "ad_account_ids")) {
    updates.ad_account_ids = Array.isArray(body.ad_account_ids) && body.ad_account_ids.length ? body.ad_account_ids : null
  }
  if (!Object.keys(updates).length) return Response.json({ error: "nada para atualizar" }, { status: 400 })
  const supabase = createServiceClient()
  const { data } = await supabase.from("api_keys").update(updates)
    .eq("id", id)
    .eq("tenant_id", tenant.tenant_id)
    .select("id, name, scope, ad_account_ids, active, created_at")
    .single()
  return Response.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const { id } = await params
  const supabase = createServiceClient()
  await supabase.from("api_keys").update({ active: false })
    .eq("id", id)
    .eq("tenant_id", tenant.tenant_id)
  return Response.json({ success: true })
}
