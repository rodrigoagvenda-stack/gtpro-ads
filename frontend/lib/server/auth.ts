import { createServiceClient } from "./supabase"
import { hashKey } from "./crypto"
import { NextRequest } from "next/server"

export interface TenantContext {
  tenant_id: string
  auth_type: "jwt" | "api_key"
  scope?: string
  user_id?: string
  user_email?: string
}

export async function getTenant(req: NextRequest): Promise<TenantContext | null> {
  const auth = req.headers.get("authorization")
  if (!auth?.startsWith("Bearer ")) return null
  const token = auth.slice(7)

  const supabase = createServiceClient()
  let ctx: TenantContext | null = null

  // Verifica JWT via Supabase
  try {
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) {
      const tenantId = user.app_metadata?.tenant_id ?? user.id
      ctx = { tenant_id: tenantId, auth_type: "jwt", user_id: user.id, user_email: user.email }
    }
  } catch {}

  // Tenta como API Key
  if (!ctx) {
    const { data } = await supabase
      .from("api_keys")
      .select("tenant_id, scope")
      .eq("key_hash", hashKey(token))
      .eq("active", true)
      .single()
    if (data) ctx = { tenant_id: data.tenant_id, auth_type: "api_key", scope: data.scope }
  }

  if (!ctx) return null

  // Verifica se o tenant está ativo
  const { data: tenant } = await supabase
    .from("tenants")
    .select("active")
    .eq("id", ctx.tenant_id)
    .single()

  if (tenant && tenant.active === false) return null

  return ctx
}

export function unauthorized() {
  return Response.json({ error: "Não autorizado" }, { status: 401 })
}
