import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createServiceClient } from "@/lib/server/supabase"
import { sendText, sendButtons, sendList } from "@/lib/server/whatsapp"
import { getCampaigns, updateBudget, toggleCampaign, filterCampaignsForAgent } from "@/lib/server/meta-ads"

// ─── Types ────────────────────────────────────────────────────────────────────

type Session = { step: string; context: Record<string, any> }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizePhone(raw: string): string {
  return raw.replace("@s.whatsapp.net", "").replace("@c.us", "").replace(/\D/g, "")
}

function parseIncoming(body: any): { from: string; text: string; buttonId?: string; listId?: string } | null {
  try {
    // UazAPI format
    if (body.message && body.chat) {
      const m = body.message
      if (m.fromMe) return null

      const from = normalizePhone(m.chatid ?? body.chat.wa_chatid ?? "")
      if (!from) return null

      // buttonOrListid is the selected button/list ID
      const buttonId = m.buttonOrListid || undefined

      // content can be object (button reply) or string (text)
      let text = ""
      if (typeof m.content === "string") {
        text = m.content
      } else if (typeof m.content === "object" && m.content !== null) {
        text = m.content.selectedDisplayText ?? m.content.selectedID ?? ""
      } else if (typeof m.text === "string") {
        text = m.text
      }

      return { from, text, buttonId }
    }

    // Evolution API / generic format fallback
    const data = body.data ?? body
    const key  = data.key ?? {}
    if (key.fromMe) return null

    const from = normalizePhone(key.remoteJid ?? "")
    if (!from) return null

    const msg = data.message ?? {}
    if (msg.conversation)              return { from, text: msg.conversation }
    if (msg.extendedTextMessage?.text) return { from, text: msg.extendedTextMessage.text }

    if (msg.buttonsResponseMessage) {
      return { from, text: msg.buttonsResponseMessage.selectedDisplayText ?? "", buttonId: msg.buttonsResponseMessage.selectedButtonId }
    }
    if (msg.listResponseMessage) {
      return { from, text: msg.listResponseMessage.title ?? "", listId: msg.listResponseMessage.singleSelectReply?.selectedRowId }
    }

    return null
  } catch {
    return null
  }
}

function greeting() {
  // UTC-3 (Brasília)
  const h = (new Date().getUTCHours() - 3 + 24) % 24
  if (h < 12) return "Bom dia"
  if (h < 18) return "Boa tarde"
  return "Boa noite"
}

async function getSession(phone: string): Promise<Session> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("whatsapp_sessions")
    .select("step, context")
    .eq("phone", phone)
    .single()
  return data ?? { step: "idle", context: {} }
}

async function saveSession(phone: string, tenantId: string, step: string, context: Record<string, any> = {}): Promise<boolean> {
  const supabase = createServiceClient()
  const { error } = await supabase.from("whatsapp_sessions").upsert(
    { phone, tenant_id: tenantId, step, context, updated_at: new Date().toISOString() },
    { onConflict: "phone" }
  )
  if (error) {
    console.error("[saveSession] error:", error.message)
    return false
  }
  return true
}

async function getTenantByPhone(phone: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("agent_configs")
    .select("tenant_id, user_name")
    .eq("whatsapp_number", phone)
    .single()
  return data
}

async function getAnthropicKey(): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("platform_settings")
    .select("value_encrypted")
    .eq("key", "anthropic_api_key")
    .single()
  return data?.value_encrypted ?? ""
}

const MAIN_MENU_BUTTONS = [
  { id: "relatorio", label: "📊 Relatório" },
  { id: "alertas",   label: "🔔 Alertas"   },
  { id: "acoes",     label: "⚡ Ações"      },
]

// ─── Report agent (Claude Sonnet + tools) ─────────────────────────────────────

function splitIntoBlocks(text: string, maxLen: number): string[] {
  // Split on --- separators first, then further split long blocks
  const parts = text.split(/\s*---+\s*/).map(p => p.trim()).filter(Boolean)
  const result: string[] = []

  for (const part of parts) {
    if (part.length <= maxLen) {
      result.push(part)
      continue
    }
    // Split long block by paragraph (\n\n), then by sentence if needed
    const paragraphs = part.split(/\n\n+/)
    let buf = ""
    for (const para of paragraphs) {
      if ((buf + "\n\n" + para).trimStart().length <= maxLen) {
        buf = buf ? buf + "\n\n" + para : para
      } else {
        if (buf) result.push(buf.trim())
        buf = para.length <= maxLen ? para : para.slice(0, maxLen)
      }
    }
    if (buf.trim()) result.push(buf.trim())
  }

  return result.length ? result : [text.slice(0, maxLen)]
}

async function runReportAgent(
  tenantId: string,
  datePreset: string,
  periodLabel: string,
  includeInactive: boolean,
): Promise<string> {
  const anthropicKey = await getAnthropicKey()
  if (!anthropicKey) throw new Error("Anthropic API Key não configurada na plataforma")

  const supabase = createServiceClient()
  const { data: agentConfig } = await supabase
    .from("agent_configs")
    .select("min_roas, max_cpl")
    .eq("tenant_id", tenantId)
    .single()

  const minRoas = agentConfig?.min_roas ?? 2
  const maxCpl  = agentConfig?.max_cpl  ?? 50

  const systemPrompt = `Você é GTPRO, especialista em Meta Ads. Responda em português brasileiro.

METAS DO CLIENTE: CPL máximo R$${maxCpl} | ROAS mínimo ${minRoas}x

REGRAS ABSOLUTAS:
- NUNCA faça perguntas. NUNCA peça confirmação. Apenas analise e entregue.
- Foco em resultado: conversas, leads, CPL, ROAS. Ignore impressões/alcance/CTR.
- Por objetivo: MENSAGENS→conversas+custo/conv | LEADS→leads+CPL | VENDAS→ROAS | ENGAJAMENTO→engajamentos+custo
- Se campanha tem _agent_note, mencione que estava pausada e avalie se fazia sentido pausar.

ESTRUTURA OBRIGATÓRIA (exatamente 3 blocos separados por ---):

BLOCO 1 — RESUMO GERAL
Emoji + período + total gasto + campanhas ativas + KPI principal do período (o número mais importante). Máx 300 chars.

BLOCO 2 — CAMPANHAS
Uma linha por campanha (máx 5). Formato: [emoji status] *Nome* | [KPI] | R$[gasto]
✅ = dentro da meta | ⚠️ = acima da meta | 🔴 = crítico | 🔵 = pausada
Máx 500 chars.

BLOCO 3 — ANÁLISE E AÇÃO
O que está bom, o que está mal, e exatamente o que fazer agora. Direto ao ponto, sem rodeios. Máx 500 chars.`

  const reportTools: Anthropic.Tool[] = [
    {
      name: "get_campaigns",
      description: "Busca campanhas do Meta Ads com métricas do período",
      input_schema: {
        type: "object",
        properties: {
          date_preset: {
            type: "string",
            enum: ["today", "last_7d", "last_30d", "last_14d"],
          },
        },
        required: ["date_preset"],
      },
    },
  ]

  const client = new Anthropic({ apiKey: anthropicKey })
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Gere o relatório do período: ${periodLabel}. Chame get_campaigns com date_preset "${datePreset}". Siga a estrutura de 3 blocos.`,
    },
  ]

  for (let i = 0; i < 6; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      tools: reportTools,
      messages,
    })

    messages.push({ role: "assistant", content: response.content })

    if (response.stop_reason === "end_turn") {
      const text = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map(b => b.text)
        .join("\n")
      return text || "⚠️ O agente não retornou análise."
    }

    if (response.stop_reason === "tool_use") {
      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type !== "tool_use") continue

        let result: unknown
        try {
          if (block.name === "get_campaigns") {
            const input = block.input as { date_preset?: string }
            const all = await getCampaigns(tenantId, input.date_preset ?? datePreset)
            result = Array.isArray(all)
              ? filterCampaignsForAgent(all, includeInactive, input.date_preset ?? datePreset)
              : all
          } else {
            result = { error: "tool not available" }
          }
        } catch (e: any) {
          result = { error: e.message }
        }

        toolResults.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result) })
      }

      messages.push({ role: "user", content: toolResults })
    }
  }

  return "⚠️ Limite de iterações atingido ao gerar relatório."
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  console.log("[WA webhook] body:", JSON.stringify(body))
  if (!body) return Response.json({ ok: true })

  const msg = parseIncoming(body)
  console.log("[WA webhook] parsed msg:", JSON.stringify(msg))
  if (!msg) return Response.json({ ok: true })

  const { from, text, buttonId, listId } = msg
  console.log("[WA webhook] from:", from, "text:", text)
  const tenant = await getTenantByPhone(from)
  console.log("[WA webhook] tenant:", JSON.stringify(tenant))
  if (!tenant) {
    await sendText(
      from,
      `Olá! 👋\n\nVerifiquei aqui e seu número não está vinculado a nenhuma conta GTPRO.\n\nPossíveis motivos:\n• Você enviou de um número diferente do cadastrado\n• Sua conta ainda não está ativa\n\nPara resolver, entre em contato pelo número cadastrado na sua conta ou acesse *gtpro.vendai.pro* para contratar um plano. 🚀`
    )
    return Response.json({ ok: true })
  }

  const tenantId = tenant.tenant_id
  const userName = (tenant.user_name ?? "").trim()
  const session  = await getSession(from)
  console.log("[WA webhook] session:", JSON.stringify(session))
  const intent   = (buttonId ?? listId ?? text).toLowerCase().trim()
  console.log("[WA webhook] intent:", intent)

  // ── Menu trigger ────────────────────────────────────────────────────────────
  // Se buttonId está setado, o usuário clicou num botão — não mostrar menu de novo
  // a menos que seja explicitamente o botão "menu"
  const MENU_WORDS = ["menu", "oi", "ola", "olá", "inicio", "início", "voltar", "start"]
  const isMenuTrigger = buttonId === "menu" || (
    !buttonId && (session.step === "idle" || MENU_WORDS.includes(intent))
  )

  console.log("[WA webhook] isMenuTrigger:", isMenuTrigger)

  if (isMenuTrigger) {
    const saved = await saveSession(from, tenantId, "menu")
    if (!saved) {
      await sendText(from, "⚠️ Erro ao iniciar sessão. Tente novamente em instantes.")
      return Response.json({ ok: true })
    }
    console.log("[WA webhook] sending buttons to:", from)
    const saudacao = userName ? `${greeting()}, ${userName}! 👋 Sou o assistente GTPRO.\nComo posso te ajudar?` : `${greeting()}! 👋 Sou o assistente GTPRO.\nComo posso te ajudar?`
    const result = await sendButtons(from, saudacao, MAIN_MENU_BUTTONS)
    console.log("[WA webhook] sendButtons result:", result)
    return Response.json({ ok: true })
  }

  // ── Alertas ─────────────────────────────────────────────────────────────────
  if (intent === "alertas") {
    const supabase = createServiceClient()
    const { data: alerts } = await supabase
      .from("alerts")
      .select("message")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(10)

    if (!alerts?.length) {
      await sendText(from, "✅ Nenhum alerta ativo no momento.")
    } else {
      const lines = alerts.map(a => `• ${a.message}`).join("\n")
      await sendText(from, `🔔 *${alerts.length} alerta(s) ativo(s):*\n\n${lines}`)
    }

    await saveSession(from, tenantId, "menu")
    await sendButtons(from, "O que mais posso fazer?", MAIN_MENU_BUTTONS)
    return Response.json({ ok: true })
  }

  // ── Relatório — escolher conta ───────────────────────────────────────────────
  if (intent === "relatorio") {
    const supabase = createServiceClient()
    const { data: contas } = await supabase
      .from("meta_connections")
      .select("id, name, ad_account_id")
      .eq("tenant_id", tenantId)
      .eq("active", true)

    if (!contas?.length) {
      await sendText(from, "⚠️ Nenhuma conta de anúncios conectada.")
      await saveSession(from, tenantId, "idle")
      return Response.json({ ok: true })
    }

    if (contas.length === 1) {
      await saveSession(from, tenantId, "report_period", { connection_id: contas[0].id })
      await sendButtons(
        from,
        `Conta: ${contas[0].name ?? contas[0].ad_account_id}\n\nQual período?`,
        [
          { id: "today",   label: "Hoje"           },
          { id: "last_7d", label: "Últimos 7 dias"  },
          { id: "last_30d",label: "Últimos 30 dias" },
        ]
      )
    } else {
      await saveSession(from, tenantId, "report_account")
      await sendList(
        from,
        "Selecione a conta de anúncios:",
        "Ver contas",
        contas.map(c => ({ id: c.id, title: c.name ?? c.ad_account_id, subtitle: c.ad_account_id }))
      )
    }
    return Response.json({ ok: true })
  }

  // ── Relatório — conta selecionada ────────────────────────────────────────────
  if (session.step === "report_account") {
    const connectionId = listId ?? intent
    await saveSession(from, tenantId, "report_period", { connection_id: connectionId })
    await sendButtons(
      from,
      "Qual período?",
      [
        { id: "today",    label: "Hoje"           },
        { id: "last_7d",  label: "Últimos 7 dias"  },
        { id: "last_30d", label: "Últimos 30 dias" },
      ]
    )
    return Response.json({ ok: true })
  }

  // ── Relatório — escolher filtro de status ────────────────────────────────────
  if (session.step === "report_period") {
    const PERIODS: Record<string, string> = { today: "Hoje", last_7d: "Últimos 7 dias", last_30d: "Últimos 30 dias" }
    const datePreset  = PERIODS[intent] ? intent : "last_7d"
    const periodLabel = PERIODS[datePreset]

    await saveSession(from, tenantId, "report_filter", { datePreset, periodLabel })
    await sendButtons(
      from,
      `Período: ${periodLabel}\n\nQuer incluir campanhas pausadas no relatório?`,
      [
        { id: "filter_active",   label: "✅ Só ativas"      },
        { id: "filter_all",      label: "📊 Incluir pausadas" },
      ]
    )
    return Response.json({ ok: true })
  }

  // ── Relatório — gerar ────────────────────────────────────────────────────────
  if (session.step === "report_filter") {
    const includeInactive = intent === "filter_all"
    const { datePreset, periodLabel } = session.context as { datePreset: string; periodLabel: string }

    await sendText(from, "⏳ Agente GTPRO gerando relatório, por favor aguarde...")

    try {
      const reportText = await runReportAgent(tenantId, datePreset, periodLabel, includeInactive)
      const blocks = splitIntoBlocks(reportText, 700)
      for (const block of blocks) {
        await sendText(from, block)
      }
    } catch (e: any) {
      console.error("[WA webhook] report agent error:", e)
      await sendText(from, `❌ Erro ao gerar relatório: ${e.message}`)
    }

    await saveSession(from, tenantId, "menu")
    await sendButtons(from, "O que mais posso fazer?", MAIN_MENU_BUTTONS)
    return Response.json({ ok: true })
  }

  // ── Ações — entrar no modo ───────────────────────────────────────────────────
  if (intent === "acoes") {
    await saveSession(from, tenantId, "action")
    await sendText(from, `⚡ *Ações*\n\nO que deseja fazer?\n_Ex: "Aumentar orçamento campanha X em 5%", "Pausar campanha Y"_\n\n_menu_ para voltar.`)
    return Response.json({ ok: true })
  }

  // ── Ações — texto livre via Claude ───────────────────────────────────────────
  if (session.step === "action") {
    await sendText(from, "🤖 Analisando...")

    try {
      const anthropicKey = await getAnthropicKey()
      if (!anthropicKey) {
        await sendText(from, "⚠️ Anthropic API Key não configurada na plataforma.")
        await saveSession(from, tenantId, "idle")
        return Response.json({ ok: true })
      }

      const campaigns = await getCampaigns(tenantId, "today")
      // Só campanhas ativas, campos mínimos para o Claude
      const activeCampaigns = campaigns
        .filter((c: any) => c.status === "ACTIVE")
        .slice(0, 15)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          budget_brl: c.daily_budget ? +(c.daily_budget / 100).toFixed(2) : null,
        }))

      const client = new Anthropic({ apiKey: anthropicKey })

      const aiRes = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        tools: [
          {
            name: "update_budget",
            description: "Atualiza orçamento diário (BRL)",
            input_schema: {
              type: "object" as const,
              properties: {
                campaign_id:   { type: "string" },
                campaign_name: { type: "string" },
                new_budget:    { type: "number" },
              },
              required: ["campaign_id", "campaign_name", "new_budget"],
            },
          },
          {
            name: "set_campaign_status",
            description: "Pausa (PAUSED) ou ativa (ACTIVE) campanha",
            input_schema: {
              type: "object" as const,
              properties: {
                campaign_id:   { type: "string" },
                campaign_name: { type: "string" },
                status:        { type: "string", enum: ["ACTIVE", "PAUSED"] },
              },
              required: ["campaign_id", "campaign_name", "status"],
            },
          },
        ],
        system: `Gestor de tráfego pago. Resposta curta em português. Campanhas ativas: ${JSON.stringify(activeCampaigns)}. Para % calcule sobre budget_brl.`,
        messages: [{ role: "user", content: text }],
      })

      let reply = ""

      for (const block of aiRes.content) {
        if (block.type === "text") {
          reply = block.text
        } else if (block.type === "tool_use") {
          const input = block.input as any

          if (block.name === "update_budget") {
            try {
              await updateBudget(tenantId, input.campaign_id, input.new_budget)
              reply = `✅ Orçamento de *${input.campaign_name}* atualizado para *R$ ${input.new_budget.toFixed(2).replace(".", ",")}*/dia`
            } catch (e: any) {
              reply = `❌ Erro ao atualizar orçamento: ${e.message}`
            }
          }

          if (block.name === "set_campaign_status") {
            try {
              await toggleCampaign(tenantId, input.campaign_id, input.status)
              const label = input.status === "ACTIVE" ? "ativada" : "pausada"
              reply = `✅ Campanha *${input.campaign_name}* ${label} com sucesso`
            } catch (e: any) {
              reply = `❌ Erro: ${e.message}`
            }
          }
        }
      }

      if (reply) await sendText(from, reply)
    } catch (e: any) {
      await sendText(from, `❌ Erro ao processar: ${e.message}`)
    }

    await saveSession(from, tenantId, "action")
    await sendButtons(from, "Posso fazer mais alguma coisa?", [
      { id: "acoes",     label: "⚡ Nova ação"   },
      { id: "relatorio", label: "📊 Relatório"   },
      { id: "menu",      label: "🏠 Menu"         },
    ])
    return Response.json({ ok: true })
  }

  // ── Fallback ─────────────────────────────────────────────────────────────────
  await saveSession(from, tenantId, "idle")
  await sendButtons(from, `${greeting()}! Como posso te ajudar?`, MAIN_MENU_BUTTONS)
  return Response.json({ ok: true })
}
