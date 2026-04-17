"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import KpiCard from "@/components/dashboard/KpiCard"
import CampaignRow from "@/components/dashboard/CampaignRow"
import type { Campaign } from "@/types"

const DATE_PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "last_7d", label: "7 dias" },
  { value: "last_30d", label: "30 dias" },
  { value: "this_month", label: "Este mês" },
]

export default function CampanhasPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [insights, setInsights] = useState<Record<string, number>>({})
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
                datePreset === p.value
                  ? "bg-violet-600 text-white"
                  : "text-zinc-400 hover:text-zinc-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Gasto total"
          value={formatCurrency(insights.spend || totalSpend)}
          highlight
        />
        <KpiCard
          label="ROAS"
          value={insights.roas ? `${Number(insights.roas).toFixed(2)}x` : "—"}
        />
        <KpiCard
          label="CPC"
          value={insights.cpc ? formatCurrency(Number(insights.cpc)) : "—"}
        />
        <KpiCard
          label="CTR"
          value={insights.ctr ? `${Number(insights.ctr).toFixed(2)}%` : "—"}
        />
      </div>

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
