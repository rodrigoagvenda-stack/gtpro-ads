import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const supabase = createServiceClient()
  const { data } = await supabase
    .from("chat_messages")
    .select("id, role, content, tools_used, actions, model, created_at")
    .eq("tenant_id", tenant.tenant_id)
    .order("created_at", { ascending: true })
    .limit(200)

  return Response.json(data ?? [])
}

export async function DELETE(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const supabase = createServiceClient()
  await supabase.from("chat_messages").delete().eq("tenant_id", tenant.tenant_id)
  return Response.json({ ok: true })
}
