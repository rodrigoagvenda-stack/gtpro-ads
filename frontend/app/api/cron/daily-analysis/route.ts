import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createServiceClient } from "@/lib/server/supabase"
import { sendText } from "@/lib/server/whatsapp"
import { getCampaigns, filterCampaignsForAgent } from "@/lib/server/meta-ads"

// ─── Auth ─────────────────────────────────────────────────────────────────────

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const auth = req.headers.get("authorization") ?? ""
  return auth === `Bearer ${secret}`
}

// ─── Brasília time ────────────────────────────────────────────────────────────

function brHour(): number {
  return (new Date().getUTCHours() - 3 + 24) % 24
}

// ─── Anthropic key helper ─────────────────────────────────────────────────────

async function getAnthropicKey(): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("platform_settings")
    .select("value_encrypted")
    .eq("key", "anthropic_api_key")
    .single()
  return data?.value_encrypted ?? ""
}

// ─── Run analysis for one tenant ─────────────────────────────────────────────

async function analyzeForTenant(
  tenantId: string,
  userName: string,
  anthropicKey: string,
): Promise<string> {
  const supabase = createServiceClient()
  const { data: agentConfig } = await supabase
    .from("agent_configs")
    .select("min_roas, max_cpl, objetivo_principal")
    .eq("tenant_id", tenantId)
    .single()

  const minRoas = agentConfig?.min_roas ?? 2
  const maxCpl  = agentConfig?.max_cpl  ?? 50

  const client = new Anthropic({ apiKey: anthropicKey })

  const systemPrompt = `Você é GTPRO, especialista em Meta Ads. Responda SEMPRE em português brasileiro.

Faça uma análise proativa e objetiva das campanhas. Seu foco são resultados reais: conversas iniciadas, leads, CPL, ROAS. Ignore métricas de vaidade.

Metas do cliente:
- ROAS mínimo: ${minRoas}x
- CPL máximo: R$${maxCpl}

Formato da mensagem (2-3 parágrafos, máximo 600 chars total):
1. Saudação com nome e resumo do dia (o que está indo bem ou mal)
2. Destaque 1-2 campanhas com insight acionável ("está com CPL R$X acima da meta, considere...")
3. Recomendação clara do que fazer agora

Use WhatsApp formatting: *negrito* para números importantes. Seja direto e prático.
NÃO comece com "Olá ${userName}" — isso é adicionado automaticamente.`

  const tools: Anthropic.Tool[] = [
    {
      name: "get_campaigns",
      description: "Busca campanhas e métricas do Meta Ads",
      input_schema: {
        type: "object",
        properties: {
          date_preset: { type: "string", enum: ["today", "last_7d"], description: "Período" },
        },
        required: ["date_preset"],
      },
    },
  ]

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Analise as campanhas de hoje e dos últimos 7 dias (use get_campaigns duas vezes: "today" e "last_7d"). Compare os resultados e identifique o que precisa de ação imediata.`,
    },
  ]

  for (let i = 0; i < 6; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages,
    })

    messages.push({ role: "assistant", content: response.content })

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map(b => b.text)
        .join("\n")
      return text
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== "tool_use") continue
        let result: unknown
        try {
          const input = block.input as { date_preset?: string }
          const all = await getCampaigns(tenantId, input.date_preset ?? "last_7d")
          result = Array.isArray(all) ? filterCampaignsForAgent(all) : all
        } catch (e: any) {
          result = { error: e.message }
        }
        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) })
      }
      messages.push({ role: "user", content: toolResults })
    }
  }

  return "Não foi possível gerar análise."
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const hour = brHour()
  const supabase = createServiceClient()

  // Fetch all tenants with daily analysis enabled and whatsapp number set
  const { data: tenants, error } = await supabase
    .from("agent_configs")
    .select("tenant_id, whatsapp_number, user_name, daily_analysis_morning, daily_analysis_afternoon")
    .eq("daily_analysis_enabled", true)
    .not("whatsapp_number", "is", null)
    .neq("whatsapp_number", "")

  if (error) {
    console.error("[cron daily-analysis] fetch error:", error.message)
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!tenants?.length) {
    return Response.json({ ok: true, processed: 0, reason: "no tenants with daily_analysis_enabled" })
  }

  // Filter tenants whose scheduled hour matches current BRT hour
  const due = tenants.filter(t => {
    const morning   = t.daily_analysis_morning   ?? 9
    const afternoon = t.daily_analysis_afternoon ?? 15
    return hour === morning || hour === afternoon
  })

  if (!due.length) {
    return Response.json({ ok: true, processed: 0, hour, reason: "no tenants due at this hour" })
  }

  const anthropicKey = await getAnthropicKey()
  if (!anthropicKey) {
    return Response.json({ error: "Anthropic API Key not configured" }, { status: 500 })
  }

  const results: Array<{ tenant_id: string; status: string; error?: string }> = []

  for (const t of due) {
    try {
      const name = (t.user_name ?? "").trim() || "Gestor"
      const analysis = await analyzeForTenant(t.tenant_id, name, anthropicKey)

      const greeting = hour < 12 ? "Bom dia" : "Boa tarde"
      const message = `${greeting}, *${name}*! 👋\n\n${analysis}`

      const phone = (t.whatsapp_number as string).replace(/\D/g, "")
      await sendText(phone, message)

      results.push({ tenant_id: t.tenant_id, status: "sent" })
      console.log(`[cron daily-analysis] sent to tenant ${t.tenant_id} (${phone})`)
    } catch (e: any) {
      console.error(`[cron daily-analysis] error for tenant ${t.tenant_id}:`, e.message)
      results.push({ tenant_id: t.tenant_id, status: "error", error: e.message })
    }
  }

  return Response.json({ ok: true, hour, processed: due.length, results })
}
