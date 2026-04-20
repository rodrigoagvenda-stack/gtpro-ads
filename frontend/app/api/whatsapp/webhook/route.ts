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

      const text     = m.text || m.content || ""
      const buttonId = m.buttonOrListid || undefined

      return { from, text, buttonId: buttonId || undefined }
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
  await supabase.from("whatsapp_sessions").upsert(
    { phone, tenant_id: tenantId, step, context, updated_at: new Date().toISOString() },
    { onConflict: "phone" }
  )
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
  const intent   = (buttonId ?? listId ?? text).toLowerCase().trim()

  // ── Menu trigger ────────────────────────────────────────────────────────────
  const isMenuTrigger =
    session.step === "idle" ||
    ["menu", "oi", "ola", "olá", "inicio", "início", "voltar", "start"].includes(intent)

  if (isMenuTrigger) {
    await saveSession(from, tenantId, "menu")
    await sendButtons(from, `${greeting()}! 👋 Sou o assistente GTPRO.\nComo posso te ajudar?`, MAIN_MENU_BUTTONS)
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
    const PERIODS: Record<string, string> = {
      today:    "Hoje",
      last_7d:  "Últimos 7 dias",
      last_30d: "Últimos 30 dias",
    }
    const datePreset  = PERIODS[intent] ? intent : "last_7d"
    const periodLabel = PERIODS[datePreset]

    await sendText(from, "⏳ Gerando relatório...")

    try {
      const campaigns = await getCampaigns(tenantId, datePreset)
      const active    = campaigns.filter((c: any) => c.status === "ACTIVE")

      const totalSpend       = campaigns.reduce((s: number, c: any) => s + (c.metrics?.spend       ?? 0), 0)
      const totalImpressions = campaigns.reduce((s: number, c: any) => s + (c.metrics?.impressions ?? 0), 0)
      const totalClicks      = campaigns.reduce((s: number, c: any) => s + (c.metrics?.clicks      ?? 0), 0)
      const totalLeads       = campaigns.reduce((s: number, c: any) => s + (c.metrics?.leads       ?? 0), 0)
      const avgCtr           = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0
      const avgCpl           = totalLeads > 0 ? totalSpend / totalLeads : 0

      const roasCampaigns = campaigns.filter((c: any) => c.metrics?.roas)
      const avgRoas = roasCampaigns.length > 0
        ? roasCampaigns.reduce((s: number, c: any) => s + c.metrics.roas, 0) / roasCampaigns.length
        : 0

      const top = [...campaigns].sort((a: any, b: any) => (b.metrics?.spend ?? 0) - (a.metrics?.spend ?? 0))[0]

      const fmt = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`

      let report = `📊 *Relatório — ${periodLabel}*\n\n`
      report += `💰 Gasto total: *${fmt(totalSpend)}*\n`
      report += `👁️ Impressões: *${totalImpressions.toLocaleString("pt-BR")}*\n`
      report += `🖱️ Cliques: *${totalClicks.toLocaleString("pt-BR")}*\n`
      report += `📈 CTR médio: *${avgCtr.toFixed(2)}%*\n`
      if (avgCpl > 0)  report += `💡 CPL médio: *${fmt(avgCpl)}*\n`
      if (avgRoas > 0) report += `⭐ ROAS médio: *${avgRoas.toFixed(2)}x*\n`
      report += `\n🟢 Campanhas ativas: *${active.length}*`

      if (top) {
        report += `\n\n🏆 *Maior gasto:*\n${top.name}\n`
        report += `Gasto: ${fmt(top.metrics?.spend ?? 0)}`
        if (top.metrics?.roas) report += ` | ROAS: ${top.metrics.roas.toFixed(2)}x`
      }

      await sendText(from, report)
    } catch (e: any) {
      await sendText(from, `❌ Erro ao gerar relatório: ${e.message}`)
    }

    await saveSession(from, tenantId, "menu")
    await sendButtons(from, "O que mais posso fazer?", MAIN_MENU_BUTTONS)
    return Response.json({ ok: true })
  }

  // ── Ações — entrar no modo ───────────────────────────────────────────────────
  if (intent === "acoes") {
    await saveSession(from, tenantId, "action")
    await sendText(
      from,
      `⚡ *Modo de ações*\n\nDescreva o que deseja fazer. Exemplos:\n\n• _"Aumentar orçamento da campanha X em 5%"_\n• _"Pausar campanha Verão"_\n• _"Ativar campanha Promoção"_\n\nEnvie *menu* para voltar.`
    )
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
      const campaignList = campaigns.map((c: any) => ({
        id: c.id, name: c.name, status: c.status,
        daily_budget: c.daily_budget ? c.daily_budget / 100 : null,
      }))

      const client = new Anthropic({ apiKey: anthropicKey })

      const aiRes = await client.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        tools: [
          {
            name: "update_budget",
            description: "Atualiza o orçamento diário de uma campanha em BRL",
            input_schema: {
              type: "object" as const,
              properties: {
                campaign_id:   { type: "string" },
                campaign_name: { type: "string" },
                new_budget:    { type: "number", description: "Valor em BRL" },
              },
              required: ["campaign_id", "campaign_name", "new_budget"],
            },
          },
          {
            name: "set_campaign_status",
            description: "Pausa ou ativa uma campanha",
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
        system: `Você é um assistente de gestão de tráfego pago. Responda de forma objetiva e direta, em português.
Campanhas disponíveis: ${JSON.stringify(campaignList)}
Se o usuário pedir aumento/redução percentual, calcule o novo valor com base no daily_budget atual.
Se não encontrar a campanha pelo nome, liste as disponíveis.`,
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
