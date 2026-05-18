import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { runAgent, AgentChunk } from "@/lib/server/agent"
import { createServiceClient } from "@/lib/server/supabase"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  try {
    const { message, model, history } = await req.json()
    const supabase = createServiceClient()

    const [configRes, connRes] = await Promise.all([
      supabase.from("agent_configs").select("*").eq("tenant_id", tenant.tenant_id).single(),
      supabase.from("meta_connections").select("ad_account_id").eq("tenant_id", tenant.tenant_id).eq("active", true).eq("is_active", true).single(),
    ])

    const adAccountId = connRes.data?.ad_account_id ?? undefined

    await supabase.from("chat_messages").insert({
      tenant_id: tenant.tenant_id, role: "user", content: message,
      model: model ?? "claude-sonnet-4-6", ad_account_id: adAccountId,
    })

    const encoder = new TextEncoder()
    const send = (chunk: AgentChunk) => encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)

    const stream = new ReadableStream({
      async start(controller) {
        try {
          const result = await runAgent(
            tenant.tenant_id, message, configRes.data ?? {}, model, history, adAccountId,
            (chunk) => controller.enqueue(send(chunk))
          )
          await supabase.from("chat_messages").insert({
            tenant_id: tenant.tenant_id, role: "assistant",
            content: result.message, tools_used: result.tools_used ?? null,
            actions: result.actions_taken ?? null, model: model ?? "claude-sonnet-4-6",
            ad_account_id: adAccountId,
          })
        } catch (e: any) {
          const msg: string = e?.message ?? String(e)
          let errMsg = "Erro interno. Tente novamente."
          if (msg.includes("Conta Meta não conectada")) errMsg = "Conta Meta não conectada. Configure em Configurações → Meta Ads."
          else if (msg.includes("Token Meta") || msg.includes("Token sem permissão")) errMsg = msg
          else if (msg.includes("Permissão negada")) errMsg = msg
          else if (msg.toLowerCase().includes("overloaded")) errMsg = "Serviço de IA temporariamente sobrecarregado. Tente em instantes."
          controller.enqueue(send({ type: "error", message: errMsg }))
        } finally {
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      }
    })
  } catch (e: any) {
    return Response.json({ error: "Erro interno." }, { status: 500 })
  }
}
