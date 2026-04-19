"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import KpiCard from "@/components/dashboard/KpiCard"
import { ArrowLeft, TrendingUp, TrendingDown, ImageOff, X, Play, ExternalLink, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const DATE_PRESETS = [
  { value: "today", label: "Hoje" },
  { value: "last_7d", label: "7 dias" },
  { value: "last_30d", label: "30 dias" },
]

const STATUS_DOT: Record<string, { dot: string; label: string; badge: string }> = {
  ACTIVE:      { dot: "bg-emerald-500", label: "Ativo",          badge: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20" },
  PAUSED:      { dot: "bg-zinc-600",    label: "Pausado",        badge: "text-zinc-500 bg-white/[0.04] ring-white/[0.08]" },
  WITH_ISSUES: { dot: "bg-red-500",     label: "Com problemas",  badge: "text-red-400 bg-red-500/10 ring-red-500/20" },
}

interface AdSet {
  id: string; name: string; status: string
  daily_budget?: number; lifetime_budget?: number; optimization_goal?: string
}
interface Ad {
  id: string; name: string; status: string
  creative?: { id: string; name?: string; thumbnail_url?: string; title?: string; body?: string; video_id?: string; image_url?: string }
}
interface Insights {
  impressions?: number; clicks?: number; spend?: number; reach?: number
  ctr?: number; cpm?: number; cpc?: number
  actions?: { action_type: string; value: string }[]
  action_values?: { action_type: string; value: string }[]
}

function CreativeModal({ ad, onClose }: { ad: Ad; onClose: () => void }) {
  const c = ad.creative
  const isVideo = !!c?.video_id
  const st = STATUS_DOT[ad.status] ?? { dot: "bg-zinc-600", label: ad.status, badge: "text-zinc-500 bg-white/[0.04] ring-white/[0.08]" }
  const [videoSrc, setVideoSrc] = useState<string | null>(null)
  const [videoPicture, setVideoPicture] = useState<string | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)

  useEffect(() => {
    if (isVideo && c?.video_id) {
      setVideoLoading(true)
      api.creative.videoSource(c.video_id)
        .then((d: any) => {
          setVideoSrc(d.source ?? null)
          setVideoPicture(d.picture ?? null)
        })
        .catch(() => {})
        .finally(() => setVideoLoading(false))
    }
  }, [isVideo, c?.video_id])

  // Best available preview image: hi-res picture > image_url > thumbnail_url
  const bestPreview = videoPicture || c?.image_url || c?.thumbnail_url

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#111113] ring-1 ring-white/[0.10] rounded-2xl overflow-hidden max-w-lg w-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-zinc-200 truncate">{ad.name}</p>
            <span className={cn("mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1", st.badge)}>
              <span className={cn("w-1 h-1 rounded-full", st.dot)} />{st.label}
            </span>
          </div>
          <button onClick={onClose} className="ml-3 shrink-0 w-7 h-7 flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-colors">
            <X size={14} className="text-zinc-500" />
          </button>
        </div>

        {/* Media */}
        <div className="bg-black relative">
          {isVideo ? (
            videoSrc ? (
              <video src={videoSrc} controls autoPlay playsInline className="w-full max-h-[480px]" />
            ) : (
              <div className="relative min-h-[200px]">
                {videoLoading ? (
                  <div className="flex items-center justify-center h-48">
                    <Loader2 size={28} className="text-zinc-500 animate-spin" />
                  </div>
                ) : (
                  <>
                    {bestPreview && (
                      <img src={bestPreview} alt={ad.name} className="w-full max-h-[480px] object-contain" />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
                      <div className="w-14 h-14 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center ring-1 ring-white/20">
                        <Play size={20} className="text-white ml-1" />
                      </div>
                      <p className="text-[10px] text-zinc-500">Preview de vídeo indisponível</p>
                    </div>
                  </>
                )}
              </div>
            )
          ) : bestPreview ? (
            <img src={bestPreview} alt={ad.name} className="w-full max-h-[480px] object-contain" />
          ) : (
            <div className="w-full h-48 flex items-center justify-center">
              <ImageOff size={32} className="text-zinc-700" />
            </div>
          )}
        </div>

        {/* Copy */}
        {(c?.title || c?.body) && (
          <div className="px-5 py-4 space-y-2 border-t border-white/[0.06]">
            {c?.title && <p className="text-[13px] font-semibold text-zinc-200">{c.title}</p>}
            {c?.body  && <p className="text-[12px] text-zinc-500 leading-relaxed">{c.body}</p>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<{ ad_sets: AdSet[]; ads: Ad[]; insights: Insights } | null>(null)
  const [datePreset, setDatePreset] = useState("last_7d")
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"adsets" | "ads">("ads")
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null)

  useEffect(() => {
    setLoading(true)
    api.campaigns.detail(id, datePreset).then((d) => { setData(d); setLoading(false) })
  }, [id, datePreset])

  const insights = data?.insights ?? {}
  const adSets = data?.ad_sets ?? []
  const ads = data?.ads ?? []

  const leads    = insights.actions?.find((a) => a.action_type === "lead")?.value
  const purchases = insights.actions?.find((a) => a.action_type === "purchase")?.value
  const revenue  = insights.action_values?.find((a) => a.action_type === "purchase")?.value

  const funnelSteps = [
    { label: "Impressões", value: Number(insights.impressions ?? 0) },
    { label: "Alcance",    value: Number(insights.reach ?? 0) },
    { label: "Cliques",   value: Number(insights.clicks ?? 0) },
    ...(leads     ? [{ label: "Leads",   value: Number(leads) }]     : []),
    ...(purchases ? [{ label: "Compras", value: Number(purchases) }] : []),
  ].filter((s) => s.value > 0)

  const maxVal = funnelSteps[0]?.value ?? 1

  return (
    <div className="space-y-6">
      {selectedAd && <CreativeModal ad={selectedAd} onClose={() => setSelectedAd(null)} />}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="w-8 h-8 flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-colors shrink-0">
          <ArrowLeft size={15} className="text-zinc-400" />
        </button>
        <h1 className="text-[17px] font-semibold text-white flex-1">Detalhes da Campanha</h1>
        <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 ring-1 ring-white/[0.06]">
          {DATE_PRESETS.map((p) => (
            <button key={p.value} onClick={() => setDatePreset(p.value)}
              className={cn("px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                datePreset === p.value ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300")}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-20 text-[13px] text-zinc-600">Carregando...</div>
      ) : (
        <>
          {/* KPIs — 2 rows */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard label="Gasto"      value={formatCurrency(Number(insights.spend ?? 0))} highlight />
            <KpiCard label="Impressões" value={Number(insights.impressions ?? 0).toLocaleString("pt-BR")} />
            <KpiCard label="Cliques"    value={Number(insights.clicks ?? 0).toLocaleString("pt-BR")} />
            <KpiCard label="CTR"        value={`${Number(insights.ctr ?? 0).toFixed(2)}%`} />
            <KpiCard label="CPC"        value={formatCurrency(Number(insights.cpc ?? 0))} />
            <KpiCard label="CPM"        value={formatCurrency(Number(insights.cpm ?? 0))} />
            {leads    && <KpiCard label="Leads"  value={leads} />}
            {revenue  && <KpiCard label="Receita" value={formatCurrency(Number(revenue))} />}
          </div>

          {/* Funnel — horizontal bars */}
          {funnelSteps.length >= 2 && (
            <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-5">
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-4">Funil de conversão</p>
              <div className="space-y-3">
                {funnelSteps.map((step, i) => {
                  const pct = (step.value / maxVal) * 100
                  const conv = i > 0 && funnelSteps[i - 1].value > 0
                    ? ((step.value / funnelSteps[i - 1].value) * 100).toFixed(1) : null
                  return (
                    <div key={step.label}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] text-zinc-400">{step.label}</span>
                        <div className="flex items-center gap-3">
                          {conv && (
                            <span className={cn("text-[11px] flex items-center gap-0.5", Number(conv) >= 2 ? "text-emerald-400" : "text-zinc-600")}>
                              {Number(conv) >= 2 ? <TrendingUp size={10} /> : <TrendingDown size={10} />} {conv}%
                            </span>
                          )}
                          <span className="text-[13px] font-semibold text-zinc-200">{step.value.toLocaleString("pt-BR")}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className="h-full bg-violet-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div>
            <div className="flex items-center gap-1 mb-4 border-b border-white/[0.06]">
              {[
                { id: "ads",     label: `Criativos${ads.length > 0 ? ` (${ads.length})` : ""}` },
                { id: "adsets",  label: `Conjuntos${adSets.length > 0 ? ` (${adSets.length})` : ""}` },
              ].map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id as any)}
                  className={cn("px-4 py-2.5 text-[12px] font-medium border-b-2 -mb-px transition-colors",
                    activeTab === t.id ? "border-violet-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300")}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Creatives grid */}
            {activeTab === "ads" && (
              ads.length === 0 ? (
                <div className="text-center py-12 text-[13px] text-zinc-600">Nenhum anúncio encontrado.</div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {ads.map((ad) => {
                    const st = STATUS_DOT[ad.status] ?? { dot: "bg-zinc-600", label: ad.status, badge: "" }
                    const isVideo = !!ad.creative?.video_id
                    const thumb = ad.creative?.image_url || ad.creative?.thumbnail_url
                    return (
                      <button key={ad.id} onClick={() => setSelectedAd(ad)} className="text-left bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden hover:ring-violet-500/30 hover:bg-white/[0.04] transition-all group">
                        <div className="aspect-video bg-zinc-900 flex items-center justify-center overflow-hidden relative">
                          {thumb ? (
                            <img src={thumb} alt={ad.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          ) : (
                            <ImageOff size={20} className="text-zinc-700" />
                          )}
                          {isVideo && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                              <div className="w-9 h-9 rounded-full bg-black/50 flex items-center justify-center">
                                <Play size={14} className="text-white ml-0.5" />
                              </div>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="text-[12px] font-medium text-zinc-200 truncate">{ad.name}</p>
                          {ad.creative?.title && <p className="text-[11px] text-zinc-500 mt-0.5 truncate">{ad.creative.title}</p>}
                          <div className="flex items-center gap-1 mt-1.5">
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", st.dot)} />
                            <span className="text-[10px] text-zinc-600">{st.label}</span>
                          </div>
                        </div>
                      </button>
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
                      const st = STATUS_DOT[adSet.status] ?? { dot: "bg-zinc-600", label: adSet.status, badge: "" }
                      return (
                        <div key={adSet.id} className="flex items-center gap-4 px-5 py-3.5">
                          <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-medium text-zinc-200 truncate">{adSet.name}</p>
                            {adSet.optimization_goal && <p className="text-[11px] text-zinc-600 mt-0.5">{adSet.optimization_goal.replace(/_/g, " ")}</p>}
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
