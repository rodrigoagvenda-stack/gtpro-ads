import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const supabase = createServiceClient()

  // Get active ad_account_id for this tenant
  const { data: conn } = await supabase
    .from("meta_connections")
    .select("ad_account_id")
    .eq("tenant_id", tenant.tenant_id)
    .eq("active", true)
    .eq("is_active", true)
    .single()

  const adAccountId = conn?.ad_account_id

  let q = supabase
    .from("chat_messages")
    .select("id, role, content, tools_used, actions, model, created_at")
    .eq("tenant_id", tenant.tenant_id)
    .order("created_at", { ascending: true })
    .limit(200)

  // Filter by active account if known — each account has its own history
  if (adAccountId) {
    q = (q as any).eq("ad_account_id", adAccountId)
  }

  const { data } = await (q as any)
  return Response.json(data ?? [])
}

export async function DELETE(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const supabase = createServiceClient()

  // Get active ad_account_id
  const { data: conn } = await supabase
    .from("meta_connections")
    .select("ad_account_id")
    .eq("tenant_id", tenant.tenant_id)
    .eq("active", true)
    .eq("is_active", true)
    .single()

  const adAccountId = conn?.ad_account_id

  let q = supabase.from("chat_messages").delete().eq("tenant_id", tenant.tenant_id)
  if (adAccountId) q = (q as any).eq("ad_account_id", adAccountId)
  await (q as any)

  return Response.json({ ok: true })
}
