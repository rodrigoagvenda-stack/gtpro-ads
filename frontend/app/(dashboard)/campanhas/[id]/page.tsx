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
  id: string; name: string; status: string; effective_status?: string
  daily_budget?: number; lifetime_budget?: number; budget_remaining?: number
  optimization_goal?: string; billing_event?: string; bid_amount?: number; bid_strategy?: string
  start_time?: string; end_time?: string; created_time?: string
  targeting?: {
    age_min?: number; age_max?: number; genders?: number[]
    geo_locations?: { countries?: string[]; cities?: { name: string; region?: string }[] }
    interests?: { id: string; name: string }[]
    custom_audiences?: { id: string; name: string }[]
    excluded_custom_audiences?: { id: string; name: string }[]
  }
  insights?: { data?: Array<{
    impressions?: string; reach?: string; clicks?: string; spend?: string
    ctr?: string; cpc?: string; cpm?: string; frequency?: string
    actions?: Array<{ action_type: string; value: string }>
  }> }
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
  const [activeTab, setActiveTab] = useState<"adsets" | "ads" | "breakdown">("ads")
  const [breakdownType, setBreakdownType] = useState("age,gender")
  const [breakdownData, setBreakdownData] = useState<any[]>([])
  const [breakdownLoading, setBreakdownLoading] = useState(false)
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null)

  useEffect(() => {
    setLoading(true)
    api.campaigns.detail(id, datePreset).then((d) => { setData(d); setLoading(false) })
  }, [id, datePreset])

  useEffect(() => {
    if (activeTab !== "breakdown" || !id) return
    setBreakdownLoading(true)
    api.breakdowns.get(id, breakdownType, datePreset)
      .then((d: any) => setBreakdownData(Array.isArray(d) ? d : []))
      .catch(() => setBreakdownData([]))
      .finally(() => setBreakdownLoading(false))
  }, [activeTab, breakdownType, datePreset, id])

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
                { id: "ads",       label: `Criativos${ads.length > 0 ? ` (${ads.length})` : ""}` },
                { id: "adsets",    label: `Conjuntos${adSets.length > 0 ? ` (${adSets.length})` : ""}` },
                { id: "breakdown", label: "Breakdown" },
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
                        <div className="px-3 py-2.5 space-y-2">
                          <p className="text-[12px] font-medium text-zinc-200 truncate">{ad.name}</p>
                          {ad.creative?.title && <p className="text-[11px] text-zinc-500 truncate">{ad.creative.title}</p>}
                          <div className="flex items-center gap-1">
                            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", st.dot)} />
                            <span className="text-[10px] text-zinc-600">{st.label}</span>
                          </div>
                          {(() => {
                            const ins = (ad as any).insights?.data?.[0]
                            if (!ins) return null
                            const spend = Number(ins.spend ?? 0)
                            const leads = ins.actions?.find((a: any) => a.action_type === "lead")?.value
                            const p100 = ins.video_p100_watched_actions?.[0]?.value
                            return (
                              <div className="border-t border-white/[0.05] pt-2 grid grid-cols-2 gap-1">
                                {spend > 0 && <div><p className="text-[9px] text-zinc-700">Gasto</p><p className="text-[11px] font-semibold text-zinc-300">{formatCurrency(spend)}</p></div>}
                                {ins.impressions && <div><p className="text-[9px] text-zinc-700">Imp.</p><p className="text-[11px] font-semibold text-zinc-300">{Number(ins.impressions).toLocaleString("pt-BR")}</p></div>}
                                {ins.ctr && <div><p className="text-[9px] text-zinc-700">CTR</p><p className="text-[11px] font-semibold text-zinc-300">{Number(ins.ctr).toFixed(2)}%</p></div>}
                                {ins.cpc && <div><p className="text-[9px] text-zinc-700">CPC</p><p className="text-[11px] font-semibold text-zinc-300">{formatCurrency(Number(ins.cpc))}</p></div>}
                                {leads && <div><p className="text-[9px] text-zinc-700">Leads</p><p className="text-[11px] font-semibold text-emerald-400">{leads}</p></div>}
                                {p100 && <div><p className="text-[9px] text-zinc-700">100%</p><p className="text-[11px] font-semibold text-violet-400">{Number(p100).toLocaleString("pt-BR")}</p></div>}
                              </div>
                            )
                          })()}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            )}

            {/* Ad Sets */}
            {/* Breakdown */}
            {activeTab === "breakdown" && (() => {
              const BREAKDOWN_OPTIONS = [
                { value: "age,gender",          label: "Idade / Gênero" },
                { value: "publisher_platform",  label: "Plataforma" },
                { value: "impression_device",   label: "Dispositivo" },
                { value: "region",              label: "Região" },
                { value: "country",             label: "País" },
              ]
              const maxSpend = Math.max(...breakdownData.map(r => Number(r.spend ?? 0)), 1)
              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {BREAKDOWN_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setBreakdownType(o.value)}
                        className={cn("px-3 py-1 rounded-full text-[11px] font-medium transition-colors",
                          breakdownType === o.value ? "bg-violet-600 text-white" : "bg-white/[0.04] text-zinc-500 hover:text-zinc-300 ring-1 ring-white/[0.06]"
                        )}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                  {breakdownLoading ? (
                    <div className="flex items-center gap-2 text-zinc-600 text-[13px] py-8">
                      <Loader2 size={14} className="animate-spin" /> Carregando...
                    </div>
                  ) : breakdownData.length === 0 ? (
                    <p className="text-[13px] text-zinc-600 py-8 text-center">Sem dados para este período.</p>
                  ) : (
                    <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
                      <div className="divide-y divide-white/[0.04]">
                        {breakdownData
                          .sort((a, b) => Number(b.spend ?? 0) - Number(a.spend ?? 0))
                          .map((row, i) => {
                            const label = [row.age, row.gender === "male" ? "M" : row.gender === "female" ? "F" : row.gender, row.publisher_platform, row.impression_device, row.region, row.country].filter(Boolean).join(" · ")
                            const spend = Number(row.spend ?? 0)
                            const pct = maxSpend > 0 ? (spend / maxSpend) * 100 : 0
                            const leads = row.actions?.find((a: any) => a.action_type === "lead")?.value
                            return (
                              <div key={i} className="px-5 py-3">
                                <div className="flex items-center justify-between gap-3 mb-1.5">
                                  <p className="text-[12px] font-medium text-zinc-300">{label || "—"}</p>
                                  <div className="flex items-center gap-4 text-[11px] text-zinc-500 shrink-0">
                                    {spend > 0 && <span>{formatCurrency(spend)}</span>}
                                    {row.impressions && <span>{Number(row.impressions).toLocaleString("pt-BR")} imp.</span>}
                                    {row.clicks && <span>{Number(row.clicks).toLocaleString("pt-BR")} cliques</span>}
                                    {row.ctr && <span>{Number(row.ctr).toFixed(2)}% CTR</span>}
                                    {leads && <span>{leads} leads</span>}
                                  </div>
                                </div>
                                <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden">
                                  <div className="h-full bg-violet-500/60 rounded-full" style={{ width: `${pct}%` }} />
                                </div>
                              </div>
                            )
                          })
                        }
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}

            {activeTab === "adsets" && (
              adSets.length === 0 ? (
                <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl px-5 py-12 text-center text-[13px] text-zinc-600">Nenhum conjunto encontrado.</div>
              ) : (
                <div className="space-y-3">
                  {adSets.map((adSet) => {
                    const st = STATUS_DOT[adSet.status] ?? { dot: "bg-zinc-600", label: adSet.status, badge: "text-zinc-500 bg-white/[0.04] ring-white/[0.08]" }
                    const ins = adSet.insights?.data?.[0]
                    const t = adSet.targeting ?? {}
                    const spend = ins?.spend ? Number(ins.spend) : 0
                    const leads = ins?.actions?.find(a => a.action_type === "lead")?.value
                    const msgs  = ins?.actions?.find(a =>
                      a.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
                      a.action_type === "onsite_conversion.total_messaging_connection"
                    )?.value
                    const purchases = ins?.actions?.find(a => a.action_type === "purchase")?.value
                    const cpl = leads && spend > 0 ? formatCurrency(spend / Number(leads)) : null
                    const genderLabel = !t.genders ? "Todos" : t.genders.includes(1) && t.genders.includes(2) ? "Todos" : t.genders.includes(1) ? "Masculino" : "Feminino"
                    const locLabel = [
                      ...(t.geo_locations?.cities?.slice(0, 3).map(c => c.name) ?? []),
                      ...(t.geo_locations?.countries ?? []),
                    ].join(", ") || null

                    return (
                      <div key={adSet.id} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-5 space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[14px] font-semibold text-zinc-100">{adSet.name}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ring-1", st.badge)}>
                                <span className={cn("w-1 h-1 rounded-full", st.dot)} />{st.label}
                              </span>
                              {adSet.optimization_goal && (
                                <span className="text-[10px] text-zinc-600 bg-white/[0.03] ring-1 ring-white/[0.06] px-2 py-0.5 rounded-full">
                                  {adSet.optimization_goal.replace(/_/g, " ")}
                                </span>
                              )}
                              {adSet.billing_event && (
                                <span className="text-[10px] text-zinc-600 bg-white/[0.03] ring-1 ring-white/[0.06] px-2 py-0.5 rounded-full">
                                  {adSet.billing_event.replace(/_/g, " ")}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {adSet.daily_budget ? (
                              <>
                                <p className="text-[13px] font-semibold text-zinc-200">{formatCurrency(adSet.daily_budget / 100)}<span className="text-zinc-600 text-[11px]">/dia</span></p>
                                {adSet.budget_remaining != null && (
                                  <p className="text-[10px] text-zinc-600 mt-0.5">Restante: {formatCurrency(adSet.budget_remaining / 100)}</p>
                                )}
                              </>
                            ) : adSet.lifetime_budget ? (
                              <>
                                <p className="text-[13px] font-semibold text-zinc-200">{formatCurrency(adSet.lifetime_budget / 100)}<span className="text-zinc-600 text-[11px]"> total</span></p>
                                {adSet.budget_remaining != null && (
                                  <p className="text-[10px] text-zinc-600 mt-0.5">Restante: {formatCurrency(adSet.budget_remaining / 100)}</p>
                                )}
                              </>
                            ) : null}
                          </div>
                        </div>

                        {/* Insights */}
                        {ins && (
                          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                            {[
                              { label: "Gasto",       value: spend > 0 ? formatCurrency(spend) : "—" },
                              { label: "Impressões",  value: ins.impressions ? Number(ins.impressions).toLocaleString("pt-BR") : "—" },
                              { label: "Alcance",     value: ins.reach ? `${(Number(ins.reach)/1000).toFixed(1)}k` : "—" },
                              { label: "Cliques",     value: ins.clicks ? Number(ins.clicks).toLocaleString("pt-BR") : "—" },
                              { label: "CTR",         value: ins.ctr ? `${Number(ins.ctr).toFixed(2)}%` : "—" },
                              { label: "CPC",         value: ins.cpc ? formatCurrency(Number(ins.cpc)) : "—" },
                              { label: "CPM",         value: ins.cpm ? formatCurrency(Number(ins.cpm)) : "—" },
                              ...(leads ? [{ label: "Leads", value: leads }] : []),
                              ...(cpl ? [{ label: "CPL", value: cpl }] : []),
                              ...(msgs ? [{ label: "Conversas", value: msgs }] : []),
                              ...(purchases ? [{ label: "Compras", value: purchases }] : []),
                              ...(ins.frequency ? [{ label: "Freq.", value: Number(ins.frequency).toFixed(1) }] : []),
                            ].map(m => (
                              <div key={m.label} className="bg-white/[0.03] rounded-lg px-3 py-2">
                                <p className="text-[10px] text-zinc-600 uppercase tracking-wide">{m.label}</p>
                                <p className="text-[12px] font-semibold text-zinc-200 mt-0.5">{m.value}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Targeting + Schedule */}
                        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-[11px] text-zinc-500 border-t border-white/[0.04] pt-3">
                          {t.age_min != null && (
                            <span><span className="text-zinc-700">Idade: </span>{t.age_min}–{t.age_max ?? "65+"}</span>
                          )}
                          <span><span className="text-zinc-700">Gênero: </span>{genderLabel}</span>
                          {locLabel && <span><span className="text-zinc-700">Local: </span>{locLabel}</span>}
                          {t.interests && t.interests.length > 0 && (
                            <span><span className="text-zinc-700">Interesses: </span>{t.interests.slice(0, 3).map(i => i.name).join(", ")}{t.interests.length > 3 ? ` +${t.interests.length - 3}` : ""}</span>
                          )}
                          {t.custom_audiences && t.custom_audiences.length > 0 && (
                            <span><span className="text-zinc-700">Públicos: </span>{t.custom_audiences.map(a => a.name).join(", ")}</span>
                          )}
                          {adSet.start_time && (
                            <span><span className="text-zinc-700">Início: </span>{new Date(adSet.start_time).toLocaleDateString("pt-BR")}</span>
                          )}
                          {adSet.end_time && (
                            <span><span className="text-zinc-700">Fim: </span>{new Date(adSet.end_time).toLocaleDateString("pt-BR")}</span>
                          )}
                          {adSet.bid_amount && (
                            <span><span className="text-zinc-700">Lance: </span>{formatCurrency(adSet.bid_amount / 100)}</span>
                          )}
                          {adSet.bid_strategy && (
                            <span><span className="text-zinc-700">Estratégia: </span>{adSet.bid_strategy.replace(/_/g, " ")}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}
          </div>
        </>
      )}
    </div>
  )
}
