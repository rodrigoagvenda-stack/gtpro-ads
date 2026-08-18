import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

// Um "cliente" vincula uma conexão Meta e uma conexão Google Ads que pertencem
// à mesma empresa, para trocar as duas juntas em vez de dois seletores separados
// e sem sincronia (ver frontend/app/api/meta/accounts e frontend/app/api/google/accounts).
export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("client_ad_accounts")
    .select(`
      id, name, is_active, meta_connection_id, google_connection_id,
      meta_connection:meta_connections ( id, ad_account_id, name ),
      google_connection:google_connections ( id, customer_id, customer_name )
    `)
    .eq("tenant_id", tenant.tenant_id)
    .order("created_at", { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const body = await req.json().catch(() => ({}))
  const { id, name, meta_connection_id, google_connection_id } = body
  if (!id && !name?.trim()) return Response.json({ error: "name obrigatório" }, { status: 400 })

  const supabase = createServiceClient()
  const payload: Record<string, unknown> = {
    tenant_id:            tenant.tenant_id,
    meta_connection_id:   meta_connection_id ?? null,
    google_connection_id: google_connection_id ?? null,
  }
  if (name?.trim()) payload.name = name.trim()
  if (id) payload.id = id

  const { data, error } = await supabase
    .from("client_ad_accounts")
    .upsert(payload, { onConflict: "id" })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json(data)
}

// Ativa um cliente: torna ele o ativo e propaga is_active para a conexão Meta
// e a conexão Google vinculadas, mantendo os dois seletores sincronizados.
export async function PATCH(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const { id } = await req.json().catch(() => ({}))
  if (!id) return Response.json({ error: "id obrigatório" }, { status: 400 })

  const supabase = createServiceClient()

  const { data: client, error: findErr } = await supabase
    .from("client_ad_accounts")
    .select("id, meta_connection_id, google_connection_id")
    .eq("id", id)
    .eq("tenant_id", tenant.tenant_id)
    .single()

  if (findErr || !client) return Response.json({ error: "Cliente não encontrado" }, { status: 404 })

  await supabase.from("client_ad_accounts").update({ is_active: false }).eq("tenant_id", tenant.tenant_id)
  await supabase.from("client_ad_accounts").update({ is_active: true }).eq("id", id)

  if (client.meta_connection_id) {
    await supabase.from("meta_connections").update({ is_active: false }).eq("tenant_id", tenant.tenant_id)
    await supabase.from("meta_connections").update({ is_active: true }).eq("id", client.meta_connection_id)
  }
  if (client.google_connection_id) {
    await supabase.from("google_connections").update({ is_active: false }).eq("tenant_id", tenant.tenant_id)
    await supabase.from("google_connections").update({ is_active: true }).eq("id", client.google_connection_id)
  }

  return Response.json({ ok: true })
}
