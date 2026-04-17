import { createServiceClient } from "./supabase"
import { hashKey } from "./crypto"
import { jwtVerify } from "jose"
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

  // Tenta como JWT do Supabase
  try {
    const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!)
    const { payload } = await jwtVerify(token, secret)
    const tenant_id = (payload as any).app_metadata?.tenant_id
    if (tenant_id) return { tenant_id, auth_type: "jwt" }
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
