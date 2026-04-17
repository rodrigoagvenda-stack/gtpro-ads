import { createServiceClient } from "./supabase"
import { hashKey } from "./crypto"
import { NextRequest } from "next/server"

export interface TenantContext {
  tenant_id: string
  auth_type: "jwt" | "api_key"
  scope?: string
}

export async function getTenant(req: NextRequest): Promise<TenantContext | null> {
  const auth = req.headers.get("authorization")
  if (!auth?.startsWith("Bearer ")) return null
  const token = auth.slice(7)

  // Verifica JWT via Supabase
  try {
    const supabase = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    if (user) return { tenant_id: user.id, auth_type: "jwt" }
  } catch {}

  // Tenta como API Key (para MAX e agentes externos)
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("api_keys")
    .select("tenant_id, scope")
    .eq("key_hash", hashKey(token))
    .eq("active", true)
    .single()

  if (data) return { tenant_id: data.tenant_id, auth_type: "api_key", scope: data.scope }

  return null
}

export function unauthorized() {
  return Response.json({ error: "Não autorizado" }, { status: 401 })
}
