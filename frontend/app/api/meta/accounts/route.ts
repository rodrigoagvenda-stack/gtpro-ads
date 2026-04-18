import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const supabase = createServiceClient()
  const { data } = await supabase
    .from("meta_connections")
    .select("id, ad_account_id, name, is_active, created_at")
    .eq("tenant_id", tenant.tenant_id)
    .eq("active", true)
    .order("created_at", { ascending: true })

  return Response.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const { id } = await req.json()
  const supabase = createServiceClient()

  await supabase
    .from("meta_connections")
    .update({ is_active: false })
    .eq("tenant_id", tenant.tenant_id)

  await supabase
    .from("meta_connections")
    .update({ is_active: true })
    .eq("id", id)
    .eq("tenant_id", tenant.tenant_id)

  return Response.json({ success: true })
}
