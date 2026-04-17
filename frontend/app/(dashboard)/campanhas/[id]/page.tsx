"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import KpiCard from "@/components/dashboard/KpiCard"
import { ArrowLeft, Play, Pause, TrendingUp, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"

const DATE_PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "last_7d", label: "7 dias" },
  { value: "last_30d", label: "30 dias" },
]

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Ativo", color: "bg-emerald-500/20 text-emerald-400" },
  PAUSED: { label: "Pausado", color: "bg-zinc-700 text-zinc-400" },
  WITH_ISSUES: { label: "Com problemas", color: "bg-red-500/20 text-red-400" },
}

interface AdSet {
  id: string
  name: string
  status: string
  daily_budget?: number
  lifetime_budget?: number
  optimization_goal?: string
}

interface Insights {
  impressions?: number
  clicks?: number
  spend?: number
  reach?: number
  ctr?: number
  cpm?: number
  cpc?: number
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<{ ad_sets: AdSet[]; insights: Insights } | null>(null)
  const [datePreset, setDatePreset] = useState("last_7d")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.campaigns.detail(id, datePreset).then((d) => {
      setData(d)
      setLoading(false)
    })
  }, [id, datePreset])

  const insights = data?.insights ?? {}
  const adSets = data?.ad_sets ?? []

  const leads = insights.actions?.find((a) => a.action_type === "lead")?.value
  const purchases = insights.actions?.find((a) => a.action_type === "purchase")?.value
  const revenue = insights.action_values?.find((a) => a.action_type === "purchase")?.value

  // Funnel data
  const funnelSteps = [
    { label: "Impressões", value: Number(insights.impressions ?? 0) },
    { label: "Alcance", value: Number(insights.reach ?? 0) },
    { label: "Cliques", value: Number(insights.clicks ?? 0) },
    ...(leads ? [{ label: "Leads", value: Number(leads) }] : []),
    ...(purchases ? [{ label: "Compras", value: Number(purchases) }] : []),
  ].filter((s) => s.value > 0)

  const maxVal = funnelSteps[0]?.value ?? 1

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-zinc-800 transition-colors">
          <ArrowLeft size={16} className="text-zinc-400" />
        </button>
        <h1 className="text-xl font-semibold text-white flex-1 truncate">Detalhes da Campanha</h1>
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

      {loading ? (
        <div className="text-center py-16 text-zinc-500 text-sm">Carregando métricas...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Gasto" value={formatCurrency(Number(insights.spend ?? 0))} highlight />
            <KpiCard label="Impressões" value={Number(insights.impressions ?? 0).toLocaleString("pt-BR")} />
            <KpiCard label="Cliques" value={Number(insights.clicks ?? 0).toLocaleString("pt-BR")} />
            <KpiCard label="CTR" value={`${Number(insights.ctr ?? 0).toFixed(2)}%`} />
            <KpiCard label="CPC" value={formatCurrency(Number(insights.cpc ?? 0))} />
            <KpiCard label="CPM" value={formatCurrency(Number(insights.cpm ?? 0))} />
            {leads && <KpiCard label="Leads" value={leads} />}
            {revenue && <KpiCard label="Receita" value={formatCurrency(Number(revenue))} />}
          </div>

          {/* Funnel */}
          {funnelSteps.length >= 2 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-sm font-medium text-zinc-300 mb-5">Funil de conversão</h2>
              <div className="space-y-2">
                {funnelSteps.map((step, i) => {
                  const pct = (step.value / maxVal) * 100
                  const convRate = i > 0 && funnelSteps[i - 1].value > 0
                    ? ((step.value / funnelSteps[i - 1].value) * 100).toFixed(1)
                    : null
                  return (
                    <div key={step.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-zinc-400">{step.label}</span>
                        <div className="flex items-center gap-3">
                          {convRate && (
                            <span className={cn("text-xs flex items-center gap-0.5", Number(convRate) >= 2 ? "text-emerald-400" : "text-yellow-400")}>
                              {Number(convRate) >= 2 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                              {convRate}%
                            </span>
                          )}
                          <span className="text-xs font-medium text-zinc-200">{step.value.toLocaleString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="h-8 bg-zinc-800 rounded-md overflow-hidden">
                        <div
                          className="h-full bg-violet-600/70 rounded-md transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Ad Sets */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-800">
              <h2 className="text-sm font-medium text-zinc-300">{adSets.length} conjunto{adSets.length !== 1 ? "s" : ""} de anúncios</h2>
            </div>
            {adSets.length === 0 ? (
              <div className="px-5 py-12 text-center text-zinc-500 text-sm">Nenhum conjunto encontrado.</div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {adSets.map((adSet) => {
                  const st = STATUS_LABELS[adSet.status] ?? { label: adSet.status, color: "bg-zinc-700 text-zinc-400" }
                  return (
                    <div key={adSet.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-zinc-100 truncate">{adSet.name}</p>
                        {adSet.optimization_goal && (
                          <p className="text-xs text-zinc-500 mt-0.5">{adSet.optimization_goal.replace(/_/g, " ")}</p>
                        )}
                      </div>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", st.color)}>{st.label}</span>
                      <div className="text-right text-xs text-zinc-400">
                        {adSet.daily_budget
                          ? <span>{formatCurrency(adSet.daily_budget / 100)}<span className="text-zinc-600">/dia</span></span>
                          : adSet.lifetime_budget
                          ? <span>{formatCurrency(adSet.lifetime_budget / 100)}<span className="text-zinc-600"> total</span></span>
                          : "—"}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
