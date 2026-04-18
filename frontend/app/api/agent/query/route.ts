import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { runAgent } from "@/lib/server/agent"
import { createServiceClient } from "@/lib/server/supabase"

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const { message, model, history } = await req.json()
  const supabase = createServiceClient()

  const { data: config } = await supabase
    .from("agent_configs")
    .select("*")
    .eq("tenant_id", tenant.tenant_id)
    .single()

  // Save user message
  await supabase.from("chat_messages").insert({
    tenant_id: tenant.tenant_id,
    role: "user",
    content: message,
    model: model ?? "claude-sonnet-4-6",
  })

  const result = await runAgent(tenant.tenant_id, message, config ?? {}, model, history)

  // Save assistant reply
  await supabase.from("chat_messages").insert({
    tenant_id: tenant.tenant_id,
    role: "assistant",
    content: result.message,
    tools_used: result.tools_used ?? null,
    actions: result.actions_taken ?? null,
    model: model ?? "claude-sonnet-4-6",
  })

  return Response.json(result)
}
