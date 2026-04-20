import { NextRequest } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createServiceClient } from "@/lib/server/supabase"
import { sendText, sendButtons, sendList } from "@/lib/server/whatsapp"
import { getCampaigns, updateBudget, toggleCampaign } from "@/lib/server/meta-ads"

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

async function saveSession(phone: string, tenantId: string, step: string, context: Record<string, any> = {}) {
  const supabase = createServiceClient()
  const { error } = await supabase.from("whatsapp_sessions").upsert(
    { phone, tenant_id: tenantId, step, context, updated_at: new Date().toISOString() },
    { onConflict: "phone" }
  )
  if (error) console.error("[saveSession] error:", error.message, "— rode a migration 010_whatsapp_agent.sql no Supabase")
}

async function getTenantByPhone(phone: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("agent_configs")
    .select("tenant_id")
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
  if (!tenant) return Response.json({ ok: true })

  const tenantId = tenant.tenant_id
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
    await saveSession(from, tenantId, "menu")
    console.log("[WA webhook] sending buttons to:", from)
    try {
      const result = await sendButtons(from, `${greeting()}! 👋 Sou o assistente GTPRO.\nComo posso te ajudar?`, MAIN_MENU_BUTTONS)
      console.log("[WA webhook] sendButtons result:", result)
    } catch (e: any) {
      console.error("[WA webhook] sendButtons error:", e.message)
    }
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
        `Conta: *${contas[0].name ?? contas[0].ad_account_id}*\n\nQual período?`,
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

  // ── Relatório — gerar ────────────────────────────────────────────────────────
  if (session.step === "report_period") {
    const PERIODS: Record<string, string> = { today: "Hoje", last_7d: "7 dias", last_30d: "30 dias" }
    const datePreset  = PERIODS[intent] ? intent : "last_7d"
    const periodLabel = PERIODS[datePreset]

    await sendText(from, "⏳ Buscando dados...")

    try {
      const campaigns = await getCampaigns(tenantId, datePreset)
      if (!campaigns?.length) {
        await sendText(from, "⚠️ Nenhuma campanha encontrada para este período.")
      } else {
        const active = campaigns.filter((c: any) => c.status === "ACTIVE")
        const withData = campaigns.filter((c: any) => (c.metrics?.spend ?? 0) > 0)

        // Totais — apenas de campanhas com dados reais
        const spend       = withData.reduce((s: number, c: any) => s + (c.metrics.spend       ?? 0), 0)
        const impressions = withData.reduce((s: number, c: any) => s + (c.metrics.impressions ?? 0), 0)
        const clicks      = withData.reduce((s: number, c: any) => s + (c.metrics.clicks      ?? 0), 0)
        const leads       = withData.reduce((s: number, c: any) => s + (c.metrics.leads       ?? 0), 0)
        const ctr         = impressions > 0 ? (clicks / impressions) * 100 : 0
        const cpl         = leads > 0 ? spend / leads : 0
        const roasArr     = withData.filter((c: any) => c.metrics?.roas > 0).map((c: any) => c.metrics.roas)
        const roas        = roasArr.length ? roasArr.reduce((a: number, b: number) => a + b, 0) / roasArr.length : 0

        const brl = (n: number) => `R$${n.toFixed(2).replace(".", ",")}`

        const lines: string[] = [
          `📊 *${periodLabel}* — ${active.length} ativas / ${campaigns.length} total`,
          ``,
          `💰 Gasto: *${brl(spend)}*`,
          `👁 Impressões: *${impressions.toLocaleString("pt-BR")}*`,
          `🖱 Cliques: *${clicks.toLocaleString("pt-BR")}* (CTR ${ctr.toFixed(2)}%)`,
        ]
        if (leads > 0)  lines.push(`🎯 Leads: *${leads}* | CPL *${brl(cpl)}*`)
        if (roas  > 0)  lines.push(`⭐ ROAS médio: *${roas.toFixed(2)}x*`)

        // Top 3 por gasto (com dados reais)
        const top3 = [...withData]
          .sort((a: any, b: any) => b.metrics.spend - a.metrics.spend)
          .slice(0, 3)

        if (top3.length) {
          lines.push(``, `🏆 *Top campanhas:*`)
          for (const c of top3) {
            const m = c.metrics
            let line = `• ${c.name.slice(0, 30)}: ${brl(m.spend)}`
            if (m.leads > 0)   line += ` | ${m.leads}L | ${brl(m.cpl)}/L`
            else if (m.roas > 0) line += ` | ROAS ${m.roas.toFixed(2)}x`
            else                 line += ` | CTR ${m.ctr?.toFixed(2) ?? 0}%`
            lines.push(line)
          }
        }

        // Alertas de campanha ativa sem entrega
        const semEntrega = active.filter((c: any) => (c.metrics?.impressions ?? 0) === 0)
        if (semEntrega.length) {
          lines.push(``, `⚠️ Sem entrega: ${semEntrega.map((c: any) => c.name.slice(0, 20)).join(", ")}`)
        }

        await sendText(from, lines.join("\n"))
      }
    } catch (e: any) {
      await sendText(from, `❌ Erro: ${e.message}`)
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
