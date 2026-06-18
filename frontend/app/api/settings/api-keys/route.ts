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
  // Aceita nome/scope via query params (legado) ou JSON body
  const qp = req.nextUrl.searchParams
  let name: string | undefined = qp.get("name") ?? undefined
  let scope: string = qp.get("scope") ?? "read_write"
  const ct = req.headers.get("content-type") ?? ""
  if (!name && ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}))
    name = body.name ?? undefined
    scope = body.scope ?? scope
  }
  if (!name) return Response.json({ error: "name obrigatório" }, { status: 400 })
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
