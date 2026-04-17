"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import KpiCard from "@/components/dashboard/KpiCard"
import CampaignRow from "@/components/dashboard/CampaignRow"
import type { Campaign } from "@/types"
import { TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

const DATE_PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "last_7d", label: "7 dias" },
  { value: "last_30d", label: "30 dias" },
  { value: "this_month", label: "Este mês" },
]

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [insights, setInsights] = useState<Record<string, any>>({})
  const [datePreset, setDatePreset] = useState("last_7d")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [cData, iData] = await Promise.all([
        api.campaigns.list(datePreset),
        api.insights.get(datePreset),
      ])
      setCampaigns(Array.isArray(cData) ? cData : [])
      setInsights(iData && typeof iData === "object" && !Array.isArray(iData) ? iData : {})
      setLoading(false)
    }
    load()
  }, [datePreset])

  async function toggleCampaign(id: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE"
    await api.campaigns.toggle(id, newStatus)
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: newStatus as Campaign["status"] } : c))
    )
  }

  const totalSpend = campaigns.reduce((acc, c) => acc + (c.metrics?.spend || 0), 0)

  // Build funnel steps from account-level insights
  const impressions = Number(insights.impressions ?? 0)
  const reach = Number(insights.reach ?? 0)
  const clicks = Number(insights.clicks ?? 0)
  const leads = insights.actions?.find((a: any) => a.action_type === "lead")?.value
  const purchases = insights.actions?.find((a: any) => a.action_type === "purchase")?.value

  const funnelSteps = [
    { label: "Impressões", value: impressions },
    ...(reach > 0 ? [{ label: "Alcance", value: reach }] : []),
    { label: "Cliques", value: clicks },
    ...(leads ? [{ label: "Leads", value: Number(leads) }] : []),
    ...(purchases ? [{ label: "Compras", value: Number(purchases) }] : []),
  ].filter((s) => s.value > 0)

  const maxVal = funnelSteps[0]?.value ?? 1
  const showFunnel = funnelSteps.length >= 3

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Campanhas</h1>
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              onClick={() => setDatePreset(p.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                datePreset === p.value ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Gasto total" value={formatCurrency(insights.spend || totalSpend)} highlight />
        <KpiCard label="ROAS" value={insights.roas ? `${Number(insights.roas).toFixed(2)}x` : "—"} />
        <KpiCard label="CPC" value={insights.cpc ? formatCurrency(Number(insights.cpc)) : "—"} />
        <KpiCard label="CTR" value={insights.ctr ? `${Number(insights.ctr).toFixed(2)}%` : "—"} />
      </div>

      {/* Funnel */}
      {showFunnel && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-zinc-300 mb-4">Funil da conta</h2>
          <div className="flex items-end gap-3">
            {funnelSteps.map((step, i) => {
              const heightPct = (step.value / maxVal) * 100
              const convRate = i > 0 && funnelSteps[i - 1].value > 0
                ? ((step.value / funnelSteps[i - 1].value) * 100).toFixed(1)
                : null
              return (
                <div key={step.label} className="flex-1 flex flex-col items-center gap-1">
                  <p className="text-xs font-medium text-zinc-200">{step.value >= 1000 ? `${(step.value / 1000).toFixed(1)}k` : step.value}</p>
                  {convRate && (
                    <p className={cn("text-xs flex items-center gap-0.5", Number(convRate) >= 2 ? "text-emerald-400" : "text-yellow-400")}>
                      {Number(convRate) >= 2 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                      {convRate}%
                    </p>
                  )}
                  <div className="w-full bg-zinc-800 rounded-t-md" style={{ height: 80 }}>
                    <div
                      className="w-full bg-violet-600/70 rounded-t-md transition-all"
                      style={{ height: `${heightPct}%`, marginTop: `${100 - heightPct}%` }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 text-center">{step.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Campaigns list */}
      <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-300">
            {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""}
          </h2>
        </div>
        {loading ? (
          <div className="px-5 py-12 text-center text-zinc-500 text-sm">Carregando...</div>
        ) : campaigns.length === 0 ? (
          <div className="px-5 py-12 text-center text-zinc-500 text-sm">Nenhuma campanha encontrada.</div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {campaigns.map((campaign) => (
              <CampaignRow
                key={campaign.id}
                campaign={campaign}
                onToggle={() => toggleCampaign(campaign.id, campaign.status)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
