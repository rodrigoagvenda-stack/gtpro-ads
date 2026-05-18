import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const { id } = await params
  const supabase = createServiceClient()
  const { error } = await supabase
    .from("media_assets")
    .delete()
    .eq("id", id)
    .eq("tenant_id", tenant.tenant_id)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
