import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { runAgent } from "@/lib/server/agent"
import { createServiceClient } from "@/lib/server/supabase"

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const { message, model, history } = await req.json()
  const supabase = createServiceClient()

  const [configRes, connRes] = await Promise.all([
    supabase.from("agent_configs").select("*").eq("tenant_id", tenant.tenant_id).single(),
    supabase.from("meta_connections").select("ad_account_id").eq("tenant_id", tenant.tenant_id).eq("active", true).eq("is_active", true).single(),
  ])

  const adAccountId = connRes.data?.ad_account_id ?? undefined

  // Save user message
  await supabase.from("chat_messages").insert({
    tenant_id: tenant.tenant_id,
    role: "user",
    content: message,
    model: model ?? "claude-sonnet-4-6",
    ad_account_id: adAccountId,
  })

  let result: Awaited<ReturnType<typeof runAgent>>
  try {
    result = await runAgent(tenant.tenant_id, message, configRes.data ?? {}, model, history, adAccountId)
  } catch (e: any) {
    const msg: string = e?.message ?? String(e)
    let status = 500
    let userMessage = "Erro interno. Tente novamente."

    if (msg.includes("Conta Meta não conectada")) {
      status = 400
      userMessage = "Conta Meta não conectada. Configure em Configurações → Meta Ads."
    } else if (msg.includes("Token Meta expirado") || msg.includes("Token Meta inválido")) {
      status = 401
      userMessage = msg
    } else if (msg.includes("Permissão negada")) {
      status = 403
      userMessage = msg
    } else if (msg.includes("Limite de requisições")) {
      status = 429
      userMessage = msg
    } else if (msg.toLowerCase().includes("anthropic") || msg.toLowerCase().includes("overloaded")) {
      status = 503
      userMessage = "Serviço de IA temporariamente indisponível. Tente novamente em instantes."
    }

    return Response.json({ error: userMessage }, { status })
  }

  // Save assistant reply
  await supabase.from("chat_messages").insert({
    tenant_id: tenant.tenant_id,
    role: "assistant",
    content: result.message,
    tools_used: result.tools_used ?? null,
    actions: result.actions_taken ?? null,
    model: model ?? "claude-sonnet-4-6",
    ad_account_id: adAccountId,
  })

  return Response.json(result)
}
