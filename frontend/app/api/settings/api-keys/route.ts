import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"
import { hashKey } from "@/lib/server/crypto"
import { randomBytes } from "crypto"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("api_keys")
    .select("id, name, scope, active, created_at")
    .eq("tenant_id", tenant.tenant_id)
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const { name, scope = "read_write" } = await req.json()
  const rawKey = `gtpro_${randomBytes(32).toString("base64url")}`
  const supabase = createServiceClient()
  const { data } = await supabase.from("api_keys").insert({
    tenant_id: tenant.tenant_id,
    name,
    key_hash: hashKey(rawKey),
    scope,
    active: true,
  }).select().single()
  return Response.json({ ...data, key: rawKey })
}
