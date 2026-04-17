"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import KpiCard from "@/components/dashboard/KpiCard"
import { ArrowLeft, TrendingUp, TrendingDown, ImageOff } from "lucide-react"
import { cn } from "@/lib/utils"

const DATE_PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "last_7d", label: "7 dias" },
  { value: "last_30d", label: "30 dias" },
]

const STATUS_DOT: Record<string, { dot: string; label: string }> = {
  ACTIVE: { dot: "bg-emerald-500", label: "Ativo" },
  PAUSED: { dot: "bg-zinc-600", label: "Pausado" },
  WITH_ISSUES: { dot: "bg-red-500", label: "Com problemas" },
}

interface AdSet {
  id: string
  name: string
  status: string
  daily_budget?: number
  lifetime_budget?: number
  optimization_goal?: string
}

interface Ad {
  id: string
  name: string
  status: string
  creative?: {
    id: string
    name?: string
    thumbnail_url?: string
    title?: string
    body?: string
  }
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
  const [data, setData] = useState<{ ad_sets: AdSet[]; ads: Ad[]; insights: Insights } | null>(null)
  const [datePreset, setDatePreset] = useState("last_7d")
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"adsets" | "ads">("ads")

  useEffect(() => {
    setLoading(true)
    api.campaigns.detail(id, datePreset).then((d) => { setData(d); setLoading(false) })
  }, [id, datePreset])

  const insights = data?.insights ?? {}
  const adSets = data?.ad_sets ?? []
  const ads = data?.ads ?? []

  const leads = insights.actions?.find((a) => a.action_type === "lead")?.value
  const purchases = insights.actions?.find((a) => a.action_type === "purchase")?.value
  const revenue = insights.action_values?.find((a) => a.action_type === "purchase")?.value

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
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-colors">
          <ArrowLeft size={15} className="text-zinc-400" />
        </button>
        <div className="flex-1">
          <h1 className="text-[17px] font-semibold text-white">Detalhes da Campanha</h1>
        </div>
        <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 ring-1 ring-white/[0.06]">
          {DATE_PRESETS.map((p) => (
            <button key={p.value} onClick={() => setDatePreset(p.value)} className={cn("px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors", datePreset === p.value ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300")}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[13px] text-zinc-600">Carregando...</div>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
            <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-5">
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-4">Funil de conversão</p>
              <div className="space-y-2">
                {funnelSteps.map((step, i) => {
                  const pct = (step.value / maxVal) * 100
                  const conv = i > 0 && funnelSteps[i - 1].value > 0
                    ? ((step.value / funnelSteps[i - 1].value) * 100).toFixed(1) : null
                  return (
                    <div key={step.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-zinc-500">{step.label}</span>
                        <div className="flex items-center gap-3">
                          {conv && (
                            <span className={cn("text-[10px] flex items-center gap-0.5", Number(conv) >= 2 ? "text-emerald-500" : "text-zinc-500")}>
                              {Number(conv) >= 2 ? <TrendingUp size={9} /> : <TrendingDown size={9} />} {conv}%
                            </span>
                          )}
                          <span className="text-[12px] font-medium text-zinc-300">{step.value.toLocaleString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="h-5 bg-white/[0.04] rounded-md overflow-hidden">
                        <div className="h-full bg-violet-600/60 rounded-md transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div>
            <div className="flex items-center gap-1 mb-4 bg-white/[0.04] rounded-lg p-0.5 ring-1 ring-white/[0.06] w-fit">
              <button onClick={() => setActiveTab("ads")} className={cn("px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors", activeTab === "ads" ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300")}>
                Criativos {ads.length > 0 && `(${ads.length})`}
              </button>
              <button onClick={() => setActiveTab("adsets")} className={cn("px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors", activeTab === "adsets" ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300")}>
                Conjuntos {adSets.length > 0 && `(${adSets.length})`}
              </button>
            </div>

            {/* Creatives */}
            {activeTab === "ads" && (
              ads.length === 0 ? (
                <div className="text-center py-12 text-[13px] text-zinc-600">Nenhum anúncio encontrado.</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {ads.map((ad) => {
                    const st = STATUS_DOT[ad.status] ?? { dot: "bg-zinc-600", label: ad.status }
                    return (
                      <div key={ad.id} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
                        {/* Thumbnail */}
                        <div className="aspect-square bg-zinc-900 flex items-center justify-center overflow-hidden">
                          {ad.creative?.thumbnail_url ? (
                            <img
                              src={ad.creative.thumbnail_url}
                              alt={ad.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <ImageOff size={24} className="text-zinc-700" />
                          )}
                        </div>
                        {/* Info */}
                        <div className="px-3 py-2.5">
                          <p className="text-[12px] font-medium text-zinc-200 truncate">{ad.name}</p>
                          {ad.creative?.title && (
                            <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{ad.creative.title}</p>
                          )}
                          {ad.creative?.body && (
                            <p className="text-[11px] text-zinc-600 mt-0.5 line-clamp-2 leading-relaxed">{ad.creative.body}</p>
                          )}
                          <div className="flex items-center gap-1 mt-2">
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", st.dot)} />
                            <span className="text-[10px] text-zinc-600">{st.label}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* Ad Sets */}
            {activeTab === "adsets" && (
              <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
                {adSets.length === 0 ? (
                  <div className="px-5 py-12 text-center text-[13px] text-zinc-600">Nenhum conjunto encontrado.</div>
                ) : (
                  <div className="divide-y divide-white/[0.04]">
                    {adSets.map((adSet) => {
                      const st = STATUS_DOT[adSet.status] ?? { dot: "bg-zinc-600", label: adSet.status }
                      return (
                        <div key={adSet.id} className="flex items-center gap-4 px-5 py-3.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-zinc-200 truncate">{adSet.name}</p>
                            {adSet.optimization_goal && (
                              <p className="text-[11px] text-zinc-600 mt-0.5">{adSet.optimization_goal.replace(/_/g, " ")}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                            <span className="text-[12px] text-zinc-500">{st.label}</span>
                          </div>
                          <div className="text-right text-[12px] text-zinc-500 shrink-0">
                            {adSet.daily_budget
                              ? <span>{formatCurrency(adSet.daily_budget / 100)}<span className="text-zinc-700">/dia</span></span>
                              : adSet.lifetime_budget
                              ? <span>{formatCurrency(adSet.lifetime_budget / 100)}</span>
                              : "—"}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
