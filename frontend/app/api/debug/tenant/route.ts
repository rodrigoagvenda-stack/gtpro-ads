import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant, unauthorized } from "@/lib/server/auth"

// GET /api/debug/tenant — mostra qual tenant_id está sendo usado e o que existe no banco
export async function GET(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return unauthorized()

  const supabase = createServiceClient()

  const { data: metaRows } = await supabase
    .from("meta_connections")
    .select("id, tenant_id, ad_account_id, active, is_active, created_at")
    .eq("tenant_id", ctx.tenant_id)

  const { data: memberRow } = await supabase
    .from("tenant_members")
    .select("id, tenant_id, role")
    .eq("id", ctx.user_id!)
    .single()

  const { data: authUser } = await supabase.auth.admin.getUserById(ctx.user_id!)

  return Response.json({
    resolved_tenant_id: ctx.tenant_id,
    user_id: ctx.user_id,
    app_metadata_tenant_id: authUser?.user?.app_metadata?.tenant_id ?? null,
    tenant_members_row: memberRow ?? null,
    meta_connections: metaRows ?? [],
  })
}
