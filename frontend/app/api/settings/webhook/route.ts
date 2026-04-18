import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant } from "@/lib/server/auth"

export async function GET(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const supabase = createServiceClient()
  const { data } = await supabase
    .from("agent_configs")
    .select("webhook_token")
    .eq("tenant_id", ctx.tenant_id)
    .single()

  return Response.json({ webhook_token: data?.webhook_token ?? null })
}

// POST regenerates the token
export async function POST(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 })

  const newToken = Array.from(crypto.getRandomValues(new Uint8Array(24)))
    .map(b => b.toString(16).padStart(2, "0")).join("")

  const supabase = createServiceClient()
  await supabase
    .from("agent_configs")
    .update({ webhook_token: newToken })
    .eq("tenant_id", ctx.tenant_id)

  return Response.json({ webhook_token: newToken })
}
