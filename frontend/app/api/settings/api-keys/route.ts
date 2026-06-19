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
    .select("id, name, scope, ad_account_ids, active, created_at")
    .eq("tenant_id", tenant.tenant_id)
    .eq("active", true)
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const qp = req.nextUrl.searchParams
  let name: string | undefined = qp.get("name") ?? undefined
  let scope: string = qp.get("scope") ?? "read_write"
  let ad_account_ids: string[] | null = null
  const ct = req.headers.get("content-type") ?? ""
  if (ct.includes("application/json")) {
    const body = await req.json().catch(() => ({}))
    name = name ?? body.name ?? undefined
    scope = body.scope ?? scope
    ad_account_ids = Array.isArray(body.ad_account_ids) && body.ad_account_ids.length ? body.ad_account_ids : null
  }
  if (!name) return Response.json({ error: "name obrigatório" }, { status: 400 })
  const rawKey = `gtpro_${randomBytes(32).toString("base64url")}`
  const supabase = createServiceClient()
  const { data } = await supabase.from("api_keys").insert({
    tenant_id: tenant.tenant_id,
    name,
    key_hash: hashKey(rawKey),
    scope,
    ad_account_ids,
    active: true,
  }).select().single()
  return Response.json({ ...data, key: rawKey })
}
