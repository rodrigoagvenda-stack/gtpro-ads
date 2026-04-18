import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant } from "@/lib/server/auth"

export async function GET(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from("skills")
    .select("*")
    .or(`tenant_id.is.null,tenant_id.eq.${ctx.tenant_id}`)
    .eq("active", true)
    .order("ordem")

  return Response.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const body = await req.json()
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from("skills")
    .insert({
      tenant_id: ctx.tenant_id,
      name:      body.name,
      icon:      body.icon ?? "Zap",
      color:     body.color ?? "violet",
      prompt:    body.prompt,
      ordem:     body.ordem ?? 99,
    })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
