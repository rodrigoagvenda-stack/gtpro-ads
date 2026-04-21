import { createServiceClient } from "./supabase"
import { getCampaigns, getInsights } from "./meta-ads"
import { sendText } from "./whatsapp"

// Objetivos válidos na Meta API por categoria
const LEAD_OBJECTIVES    = ["LEAD_GENERATION", "OUTCOME_LEADS"]
const SALES_OBJECTIVES   = ["OUTCOME_SALES", "PRODUCT_CATALOG_SALES", "CONVERSIONS"]
const MESSAGE_OBJECTIVES = ["OUTCOME_ENGAGEMENT", "MESSAGES", "OUTCOME_AWARENESS"]

export async function checkAndNotifyAlerts(tenantId: string): Promise<{ created: number; errors: string[] }> {
  const supabase = createServiceClient()
  const errors: string[] = []

  const { data: cfg } = await supabase
    .from("agent_configs")
    .select("roas_minimo,cpl_maximo,whatsapp_number")
    .eq("tenant_id", tenantId)
    .single()

  const roasMin  = cfg?.roas_minimo ?? 2
  const cplMax   = cfg?.cpl_maximo  ?? 50
  const whaPhone = cfg?.whatsapp_number ? (cfg.whatsapp_number as string).replace(/\D/g, "") : null

  let campaigns: any[] = []
  let accountInsights: any = {}
  try { campaigns = await getCampaigns(tenantId) } catch (e: any) { return { created: 0, errors: [`getCampaigns: ${e.message}`] } }
  try { accountInsights = await getInsights(tenantId, "last_7d") } catch {}

  const active = campaigns.filter((c: any) => c.status === "ACTIVE")
  let created = 0

  async function upsertAlert(type: string, message: string, campaignId?: string) {
    const { data: existing } = await supabase.from("alerts")
      .select("id").eq("tenant_id", tenantId).eq("type", type).eq("status", "active")
      .eq("campaign_id", campaignId ?? null)
      .not("message", "ilike", "Aguardando aprovação%")
      .maybeSingle()
    if (existing) return
    await supabase.from("alerts").insert({ tenant_id: tenantId, type, message, status: "active", campaign_id: campaignId ?? null })
    created++
    if (whaPhone) {
      try { await sendText(whaPhone, `🔔 *Alerta GTPRO*\n\n${message}`) } catch (e: any) { errors.push(`sendText: ${e.message}`) }
    }
  }

  // Fix C4: ROAS vem como purchase_roas (array) em insights, não campo direto
  const purchaseRoasEntry = (accountInsights.purchase_roas ?? []).find(
    (x: any) => x.action_type === "omni_purchase" || x.action_type === "offsite_conversion.fb_pixel_purchase"
  )
  const accountRoas = purchaseRoasEntry ? Number(purchaseRoasEntry.value) : 0
  if (accountRoas > 0 && accountRoas < roasMin) {
    await upsertAlert("roas_baixo", `ROAS da conta está em ${accountRoas.toFixed(2)}x (mínimo configurado: ${roasMin}x).`)
  }

  for (const c of active) {
    const m   = c.metrics ?? {}
    const obj = (c.objective ?? "").toUpperCase()

    // Fix A1: CPL só para objetivos de lead válidos (LEADS inválido removido)
    if (m.cpl && m.cpl > cplMax && LEAD_OBJECTIVES.includes(obj)) {
      await upsertAlert("cpl_alto", `Campanha "${c.name}" com CPL R$ ${m.cpl.toFixed(2)} (limite: R$ ${cplMax}).`, c.id)
    }

    // Fix M6: custo por conversa alto para campanhas de Mensagens
    const cpcConvMax = cplMax * 0.5
    if (m.cpc_conv && m.cpc_conv > cpcConvMax && MESSAGE_OBJECTIVES.includes(obj)) {
      await upsertAlert("cpl_alto", `Campanha "${c.name}" com custo/conversa R$ ${m.cpc_conv.toFixed(2)} (limite: R$ ${cpcConvMax.toFixed(2)}).`, c.id)
    }

    // ROAS baixo por campanha (vendas)
    if (m.roas && m.roas < roasMin && m.spend > 0 && SALES_OBJECTIVES.includes(obj)) {
      await upsertAlert("roas_baixo", `Campanha "${c.name}" com ROAS ${m.roas.toFixed(2)}x (mínimo: ${roasMin}x).`, c.id)
    }

    // Fix C5: budget em centavos → converter para reais antes de comparar
    const dailyBudgetBrl = c.daily_budget ? c.daily_budget / 100 : 0
    if (dailyBudgetBrl > 0 && m.spend >= dailyBudgetBrl * 0.95) {
      await upsertAlert("budget_esgotado", `Campanha "${c.name}" atingiu 95% do budget diário (R$ ${dailyBudgetBrl.toFixed(2)}).`, c.id)
    }

    if ((m.impressions ?? 0) === 0) {
      await upsertAlert("sem_entrega", `Campanha "${c.name}" está ativa mas sem impressões nos últimos 7 dias.`, c.id)
    }

    if (m.ctr !== undefined && m.ctr < 0.5 && m.impressions > 500) {
      await upsertAlert("queda_performance", `Campanha "${c.name}" com CTR baixo: ${m.ctr.toFixed(2)}%.`, c.id)
    }
  }

  return { created, errors }
}
