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
    .eq("is_active", true)
    .single()

  // Token long-lived expira em ~60 dias — avisar quando restam ≤ 10 dias
  let token_expires_soon = false
  let token_days_remaining: number | null = null
  if (data?.created_at) {
    const connectedAt = new Date(data.created_at)
    const expiresAt   = new Date(connectedAt.getTime() + 60 * 24 * 60 * 60 * 1000)
    const remaining   = Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    token_days_remaining = remaining
    token_expires_soon   = remaining <= 10
  }

  return Response.json({
    connected: !!data,
    ad_account_id: data?.ad_account_id ?? null,
    name: data?.name ?? null,
    connected_at: data?.created_at ?? null,
    token_expires_soon,
    token_days_remaining,
  })
}

export async function DELETE(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const supabase = createServiceClient()
  await supabase.from("meta_connections").update({ active: false }).eq("tenant_id", tenant.tenant_id)

  return Response.json({ success: true })
}
