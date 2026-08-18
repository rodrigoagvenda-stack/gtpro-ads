import { createServiceClient } from "./supabase"
import { hashKey } from "./crypto"
import { NextRequest } from "next/server"

export interface TenantContext {
  tenant_id: string
  auth_type: "jwt" | "api_key"
  scope?: string
  user_id?: string
  user_email?: string
  ad_account_ids?: string[] | null
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
      let tenantId: string | undefined = user.app_metadata?.tenant_id

      // Se não está no app_metadata, busca na tabela tenant_members
      if (!tenantId) {
        const { data: member } = await supabase
          .from("tenant_members")
          .select("tenant_id")
          .eq("id", user.id)
          .single()
        tenantId = member?.tenant_id
      }

      if (tenantId) {
        ctx = { tenant_id: tenantId, auth_type: "jwt", user_id: user.id, user_email: user.email }
      } else {
        console.warn(`[auth] user=${user.id} sem tenant_id resolvido (nem app_metadata nem tenant_members)`)
      }
    }
  } catch {}

  // Tenta como API Key
  if (!ctx) {
    const { data, error } = await supabase
      .from("api_keys")
      .select("tenant_id, scope, ad_account_ids")
      .eq("key_hash", hashKey(token))
      .eq("active", true)
      .single()
    if (data) {
      ctx = { tenant_id: data.tenant_id, auth_type: "api_key", scope: data.scope, ad_account_ids: data.ad_account_ids ?? null }
    } else if (error && error.code !== "PGRST116") {
      // coluna ad_account_ids pode não existir ainda — fallback sem ela
      const { data: d2 } = await supabase
        .from("api_keys")
        .select("tenant_id, scope")
        .eq("key_hash", hashKey(token))
        .eq("active", true)
        .single()
      if (d2) ctx = { tenant_id: d2.tenant_id, auth_type: "api_key", scope: d2.scope, ad_account_ids: null }
    }
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
