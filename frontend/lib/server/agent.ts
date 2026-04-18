import Anthropic from "@anthropic-ai/sdk"
import { getAnthropicKey } from "./platform"
import { createServiceClient } from "./supabase"
import { getCampaigns, getInsights, toggleCampaign, updateBudget } from "./meta-ads"

const SYSTEM_PROMPT = `Você é o GTPRO, agente especializado em gestão de tráfego pago no Meta Ads.

Analise a performance das campanhas, identifique problemas e — quando autorizado — execute otimizações.

Diretrizes:
- Sempre busque métricas antes de propor ações
- Pause campanhas só se ROAS < 1.0 por mais de 24h OU CPL > 3x o limite
- Alterações de budget acima do limite configurado requerem aprovação humana
- Justifique cada ação com dados concretos
- Responda sempre em português brasileiro`

const TOOLS: Anthropic.Tool[] = [
  {
    name: "get_campaigns",
    description: "Lista todas as campanhas com métricas.",
    input_schema: {
      type: "object" as const,
      properties: {
        date_preset: { type: "string", default: "last_7d" },
      },
    },
  },
  {
    name: "get_insights",
    description: "Retorna métricas agregadas da conta para um período.",
    input_schema: {
      type: "object" as const,
      properties: {
        date_preset: { type: "string" },
      },
      required: ["date_preset"],
    },
  },
  {
    name: "toggle_campaign",
    description: "Ativa ou pausa uma campanha.",
    input_schema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        status: { type: "string", enum: ["ACTIVE", "PAUSED"] },
      },
      required: ["campaign_id", "status"],
    },
  },
  {
    name: "update_budget",
    description: "Atualiza o orçamento de uma campanha.",
    input_schema: {
      type: "object" as const,
      properties: {
        campaign_id: { type: "string" },
        daily_budget: { type: "number" },
        lifetime_budget: { type: "number" },
      },
      required: ["campaign_id"],
    },
  },
  {
    name: "create_alert",
    description: "Registra um alerta no sistema.",
    input_schema: {
      type: "object" as const,
      properties: {
        type: { type: "string", enum: ["roas_baixo", "cpl_alto", "budget_esgotado", "campanha_rejeitada", "queda_performance"] },
        message: { type: "string" },
        campaign_id: { type: "string" },
      },
      required: ["type", "message"],
    },
  },
]

async function executeTool(name: string, input: Record<string, any>, tenantId: string, tenantConfig: Record<string, any>) {
  const supabase = createServiceClient()

  if (name === "get_campaigns") return getCampaigns(tenantId)
  if (name === "get_insights") return getInsights(tenantId, input.date_preset)
  if (name === "toggle_campaign") {
    if (tenantConfig.modo_supervisionado) {
      await supabase.from("alerts").insert({ tenant_id: tenantId, type: "roas_baixo", message: `Aguardando aprovação: ${name} em ${input.campaign_id}`, status: "active" })
      return { status: "pending_approval" }
    }
    return toggleCampaign(tenantId, input.campaign_id, input.status)
  }
  if (name === "update_budget") {
    if (tenantConfig.modo_supervisionado) {
      await supabase.from("alerts").insert({ tenant_id: tenantId, type: "roas_baixo", message: `Aguardando aprovação: alteração de budget em ${input.campaign_id}`, status: "active" })
      return { status: "pending_approval" }
    }
    return updateBudget(tenantId, input.campaign_id, input.daily_budget, input.lifetime_budget)
  }
  if (name === "create_alert") {
    const { data } = await supabase.from("alerts").insert({ tenant_id: tenantId, ...input, status: "active" }).select().single()
    return data
  }
  throw new Error(`Tool desconhecida: ${name}`)
}

function logAction(tenantId: string, action: string, params: any, result: any, status: string) {
  const supabase = createServiceClient()
  supabase.from("agent_logs").insert({ tenant_id: tenantId, action, params, result, status, justification: "" })
}

export async function runAgent(tenantId: string, message: string, tenantConfig: Record<string, any>) {
  const apiKey = await getAnthropicKey()
  const client = new Anthropic({ apiKey })

  const userContent = `Configurações: objetivo=${tenantConfig.objetivo_principal}, ROAS mín=${tenantConfig.roas_minimo}, CPL máx=${tenantConfig.cpl_maximo}, modo supervisionado=${tenantConfig.modo_supervisionado}\n\n${message}`
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userContent }]
  const actionsTaken: any[] = []
  const toolsUsed: { name: string; input: Record<string, any> }[] = []

  while (true) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages,
    })

    messages.push({ role: "assistant", content: response.content })

    if (response.stop_reason === "end_turn") {
      const text = response.content.find((b) => b.type === "text")
      return { message: (text as any)?.text ?? "", actions_taken: actionsTaken, tools_used: toolsUsed }
    }

    if (response.stop_reason === "tool_use") {
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const block of response.content) {
        if (block.type !== "tool_use") continue
        toolsUsed.push({ name: block.name, input: block.input as any })
        try {
          const result = await executeTool(block.name, block.input as any, tenantId, tenantConfig)
          logAction(tenantId, block.name, block.input, result, "success")
          if (["toggle_campaign", "update_budget"].includes(block.name)) actionsTaken.push({ tool: block.name, input: block.input, result })
          results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) })
        } catch (e: any) {
          logAction(tenantId, block.name, block.input, { error: e.message }, "failed")
          results.push({ type: "tool_result", tool_use_id: block.id, content: `Erro: ${e.message}`, is_error: true })
        }
      }
      messages.push({ role: "user", content: results })
    }
  }
}
