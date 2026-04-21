import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"
import { getCampaigns, getInsights, getCampaignInsights } from "@/lib/server/meta-ads"
import { sendText } from "@/lib/server/whatsapp"

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const tid = tenant.tenant_id
  const supabase = createServiceClient()

  const { data: cfg } = await supabase.from("agent_configs").select("roas_minimo,cpl_maximo,whatsapp_number").eq("tenant_id", tid).single()
  const roasMin    = cfg?.roas_minimo   ?? 2
  const cplMax     = cfg?.cpl_maximo   ?? 50
  const whaPhone   = cfg?.whatsapp_number ? (cfg.whatsapp_number as string).replace(/\D/g, "") : null

  let campaigns: any[] = []
  let accountInsights: any = {}
  try { campaigns = await getCampaigns(tid) } catch { return Response.json({ error: "Meta não conectado" }, { status: 400 }) }
  try { accountInsights = await getInsights(tid, "last_7d") } catch {}

  const active = campaigns.filter((c: any) => c.status === "ACTIVE")
  const created: string[] = []

  async function upsertAlert(type: string, message: string, campaignId?: string) {
    const { data: existing } = await supabase.from("alerts")
      .select("id").eq("tenant_id", tid).eq("type", type).eq("status", "active")
      .eq("campaign_id", campaignId ?? null)
      .not("message", "ilike", "Aguardando aprovação%")
      .maybeSingle()
    if (existing) return
    await supabase.from("alerts").insert({ tenant_id: tid, type, message, status: "active", campaign_id: campaignId ?? null })
    created.push(type)
    if (whaPhone) {
      try { await sendText(whaPhone, `🔔 *Alerta GTPRO*\n\n${message}`) } catch {}
    }
  }

  // Account-level: ROAS baixo
  const roas = Number(accountInsights.roas ?? 0)
  if (roas > 0 && roas < roasMin) {
    await upsertAlert("roas_baixo", `ROAS da conta está em ${roas.toFixed(2)}x (mínimo configurado: ${roasMin}x).`)
  }

  // Per campaign checks
  for (const c of active) {
    const m = c.metrics ?? {}
    // CPL alto
    if (m.cpl && m.cpl > cplMax) {
      await upsertAlert("cpl_alto", `Campanha "${c.name}" com CPL R$ ${m.cpl.toFixed(2)} (limite: R$ ${cplMax}).`, c.id)
    }
    // Budget esgotado (spend >= daily_budget ou lifetime_budget)
    if (c.daily_budget && m.spend && m.spend >= c.daily_budget * 0.95) {
      await upsertAlert("budget_esgotado", `Campanha "${c.name}" atingiu 95% do budget diário.`, c.id)
    }
    // Sem entrega (ativa mas 0 impressões nos últimos 7 dias)
    if ((m.impressions ?? 0) === 0) {
      await upsertAlert("sem_entrega", `Campanha "${c.name}" está ativa mas sem impressões nos últimos 7 dias.`, c.id)
    }
    // Queda de performance (CTR < 0.5%)
    if (m.ctr !== undefined && m.ctr < 0.5 && m.impressions > 500) {
      await upsertAlert("queda_performance", `Campanha "${c.name}" com CTR baixo: ${m.ctr.toFixed(2)}%.`, c.id)
    }
  }

  return Response.json({ checked: active.length, created: created.length, alerts: created })
}
