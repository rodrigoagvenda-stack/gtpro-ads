import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"
import { decrypt } from "@/lib/server/crypto"

const GRAPH = "https://graph.facebook.com/v25.0"

// ─── Date helpers ─────────────────────────────────────────────────────────────

function toDateRange(preset: string, since?: string | null, until?: string | null) {
  if (since && until) {
    return {
      sinceIso: new Date(`${since}T00:00:00Z`).toISOString(),
      untilIso:  new Date(`${until}T23:59:59Z`).toISOString(),
      metaRange: { since, until } as Record<string, string> | null,
      metaPreset: null as string | null,
    }
  }
  const days = preset === "today" ? 0 : preset === "last_7d" ? 7 : preset === "last_year" ? 365 : 30
  const now   = new Date()
  const start = new Date(now)
  start.setDate(start.getDate() - days)
  start.setHours(0, 0, 0, 0)
  return {
    sinceIso:   start.toISOString(),
    untilIso:   now.toISOString(),
    metaRange:  null as Record<string, string> | null,
    metaPreset: preset,
  }
}

// ─── Meta batch helpers ───────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function metaBatch(token: string, requests: { relative_url: string }[]): Promise<any[]> {
  const res = await fetch(`${GRAPH}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      access_token: token,
      batch: requests.map(r => ({ method: "GET", relative_url: r.relative_url })),
    }),
  })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data.map(item => {
    if (item?.code !== 200) return null
    try { return JSON.parse(item.body) } catch { return null }
  }) : []
}

// ─── Resolve ad IDs → campaign { id, name } via Meta Batch API ───────────────

async function resolveAdsToCampaigns(
  adIds: string[],
  token: string,
): Promise<Map<string, { id: string; name: string }>> {
  const result = new Map<string, { id: string; name: string }>()
  if (!adIds.length) return result

  for (const batch of chunk(adIds, 50)) {
    const requests = batch.map(id => ({ relative_url: `${id}?fields=campaign%7Bid%2Cname%7D` }))
    const responses = await metaBatch(token, requests).catch(() => [])
    for (let i = 0; i < batch.length; i++) {
      const body = responses[i]
      if (body?.campaign?.id) {
        result.set(batch[i], { id: body.campaign.id, name: body.campaign.name })
      }
    }
  }
  return result
}

// ─── Fetch spend per campaign ─────────────────────────────────────────────────

async function fetchCampaignSpend(
  campaignIds: string[],
  token: string,
  metaPreset: string | null,
  metaRange: Record<string, string> | null,
): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  if (!campaignIds.length) return result

  const insightSuffix = metaRange
    ? `insights.time_range({"since":"${metaRange.since}","until":"${metaRange.until}"}){spend}`
    : `insights.date_preset(${metaPreset ?? "last_30d"}){spend}`

  for (const batch of chunk(campaignIds, 50)) {
    const requests = batch.map(id => ({
      relative_url: `${id}?fields=${encodeURIComponent(insightSuffix)}`,
    }))
    const responses = await metaBatch(token, requests).catch(() => [])
    for (let i = 0; i < batch.length; i++) {
      const spend = Number(responses[i]?.insights?.data?.[0]?.spend ?? 0)
      result.set(batch[i], spend)
    }
  }
  return result
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const { searchParams } = req.nextUrl
  const preset = searchParams.get("date_preset") ?? "last_30d"
  const since  = searchParams.get("since")
  const until  = searchParams.get("until")

  const supabase = createServiceClient()

  // Meta connection for this tenant
  const { data: conn } = await supabase
    .from("meta_connections")
    .select("access_token_encrypted, ad_account_id")
    .eq("tenant_id", tenant.tenant_id)
    .eq("active", true)
    .eq("is_active", true)
    .maybeSingle()

  if (!conn) {
    return Response.json({ error: "meta_not_connected" }, { status: 424 })
  }

  const token = decrypt(conn.access_token_encrypted)
  const { sinceIso, untilIso, metaPreset, metaRange } = toDateRange(preset, since, until)

  // Leads do período com ad_id preenchido
  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select("utm_campaign, converted_at, conversion_value, metadata")
    .eq("tenant_id", tenant.tenant_id)
    .gte("created_at", sinceIso)
    .lte("created_at", untilIso)
    .not("utm_campaign", "is", null)

  if (leadsErr) return Response.json({ error: leadsErr.message }, { status: 500 })

  if (!leads?.length) {
    return Response.json({
      summary: { leads: 0, conversions: 0, revenue: 0, spend: 0, roas: 0 },
      campaigns: [],
    })
  }

  // Agrupa por ad_id
  type AdData = { leads: number; conversions: number; revenue: number; headline: string }
  const byAdId = new Map<string, AdData>()

  for (const lead of leads) {
    const adId    = lead.utm_campaign as string
    const headline = (lead.metadata as any)?.headline ?? "Desconhecido"
    const cur     = byAdId.get(adId) ?? { leads: 0, conversions: 0, revenue: 0, headline }
    cur.leads++
    if (lead.converted_at) {
      cur.conversions++
      cur.revenue += Number(lead.conversion_value ?? 0)
    }
    byAdId.set(adId, cur)
  }

  // Resolve ad → campanha
  const adIds        = [...byAdId.keys()]
  const adToCampaign = await resolveAdsToCampaigns(adIds, token)

  // Agrupa por campanha
  type CampaignAcc = {
    id: string; name: string; spend: number
    leads: number; conversions: number; revenue: number
    creatives: Map<string, { headline: string; leads: number; conversions: number; revenue: number }>
  }
  const campaignMap = new Map<string, CampaignAcc>()

  for (const [adId, data] of byAdId) {
    const campaign = adToCampaign.get(adId)
    // Leads sem campanha resolvida → agrupa em bucket "Desconhecido"
    const cid   = campaign?.id   ?? "unknown"
    const cname = campaign?.name ?? "Campanha desconhecida"

    const cur = campaignMap.get(cid) ?? {
      id: cid, name: cname, spend: 0,
      leads: 0, conversions: 0, revenue: 0,
      creatives: new Map(),
    }
    cur.leads       += data.leads
    cur.conversions += data.conversions
    cur.revenue     += data.revenue

    const creative = cur.creatives.get(data.headline) ??
      { headline: data.headline, leads: 0, conversions: 0, revenue: 0 }
    creative.leads       += data.leads
    creative.conversions += data.conversions
    creative.revenue     += data.revenue
    cur.creatives.set(data.headline, creative)

    campaignMap.set(cid, cur)
  }

  // Spend por campanha via Meta API
  const knownCampaignIds = [...campaignMap.keys()].filter(id => id !== "unknown")
  const spendMap = await fetchCampaignSpend(knownCampaignIds, token, metaPreset, metaRange)
  for (const [cid, spend] of spendMap) {
    const c = campaignMap.get(cid)
    if (c) c.spend = spend
  }

  // Serializa resposta
  const campaigns = [...campaignMap.values()]
    .map(c => ({
      id:          c.id,
      name:        c.name,
      spend:       c.spend,
      leads:       c.leads,
      conversions: c.conversions,
      revenue:     c.revenue,
      cpl:         c.leads > 0 ? c.spend / c.leads : 0,
      roas:        c.spend > 0 ? c.revenue / c.spend : 0,
      creatives:   [...c.creatives.values()],
    }))
    .sort((a, b) => b.leads - a.leads)

  const totalSpend       = campaigns.reduce((s, c) => s + c.spend,       0)
  const totalLeads       = campaigns.reduce((s, c) => s + c.leads,       0)
  const totalConversions = campaigns.reduce((s, c) => s + c.conversions, 0)
  const totalRevenue     = campaigns.reduce((s, c) => s + c.revenue,     0)

  return Response.json({
    summary: {
      leads:       totalLeads,
      conversions: totalConversions,
      revenue:     totalRevenue,
      spend:       totalSpend,
      roas:        totalSpend > 0 ? totalRevenue / totalSpend : 0,
    },
    campaigns,
  })
}
