import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const supabase = createServiceClient()
  const { data } = await supabase
    .from("meta_connections")
    .select("ad_account_id, name, created_at")
    .eq("tenant_id", tenant.tenant_id)
    .eq("active", true)
    .single()

  return Response.json({
    connected: !!data,
    ad_account_id: data?.ad_account_id ?? null,
    connected_at: data?.created_at ?? null,
  })
}

export async function DELETE(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const supabase = createServiceClient()
  await supabase.from("meta_connections").update({ active: false }).eq("tenant_id", tenant.tenant_id)

  return Response.json({ success: true })
}
