import { createServiceClient } from "./supabase"
import { getCampaigns, getInsights } from "./meta-ads"
import { sendText } from "./whatsapp"

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

  // Account-level: ROAS baixo
  const roas = Number(accountInsights.roas ?? 0)
  if (roas > 0 && roas < roasMin) {
    await upsertAlert("roas_baixo", `ROAS da conta está em ${roas.toFixed(2)}x (mínimo configurado: ${roasMin}x).`)
  }

  const LEAD_OBJECTIVES = ["LEAD_GENERATION", "OUTCOME_LEADS", "LEADS"]
  for (const c of active) {
    const m = c.metrics ?? {}
    // CPL só faz sentido para campanhas com objetivo de lead
    if (m.cpl && m.cpl > cplMax && LEAD_OBJECTIVES.includes(c.objective?.toUpperCase?.())) {
      await upsertAlert("cpl_alto", `Campanha "${c.name}" com CPL R$ ${m.cpl.toFixed(2)} (limite: R$ ${cplMax}).`, c.id)
    }
    if (c.daily_budget && m.spend && m.spend >= c.daily_budget * 0.95) {
      await upsertAlert("budget_esgotado", `Campanha "${c.name}" atingiu 95% do budget diário.`, c.id)
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
