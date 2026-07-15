"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import KpiCard from "@/components/dashboard/KpiCard"
import CampaignRow, { ALL_METRIC_DEFS, type MetricDef, type MetricKey } from "@/components/dashboard/CampaignRow"
import type { Campaign } from "@/types"
import { cn } from "@/lib/utils"
import { AlertTriangle, RefreshCw, Key, Calendar, Link2, ArrowRight, SlidersHorizontal, Check } from "lucide-react"

function isTokenExpired(msg: string) {
  return msg.includes("190") || msg.includes("463") || msg.includes("Session has expired") || msg.includes("access token")
}
function isNotConnected(msg: string) {
  return msg.toLowerCase().includes("não conectada") || msg.toLowerCase().includes("not connected") || msg.toLowerCase().includes("no active") || msg.toLowerCase().includes("sem conta")
}

const PRESETS = [
  { value: "today",     label: "Hoje" },
  { value: "yesterday", label: "Ontem" },
  { value: "last_7d",   label: "7 dias" },
  { value: "last_30d",  label: "30 dias" },
  { value: "this_month",label: "Este mês" },
  { value: "custom",    label: "Personalizado" },
]

const PAGE_SIZE = 10

// ─── Objective tabs ───────────────────────────────────────────────────────────

type ObjectiveId = "geral" | "ecommerce" | "leads" | "whatsapp" | "engajamento" | "trafego" | "seguidores"

const KPI_OBJECTIVES: { id: ObjectiveId; label: string }[] = [
  { id: "geral",       label: "Geral" },
  { id: "ecommerce",   label: "E-commerce" },
  { id: "leads",       label: "Leads" },
  { id: "whatsapp",    label: "WhatsApp" },
  { id: "engajamento", label: "Engajamento" },
  { id: "trafego",     label: "Tráfego" },
  { id: "seguidores",  label: "Seguidores" },
]

// Default metrics per objective
const DEFAULT_METRICS: Record<ObjectiveId, MetricKey[]> = {
  geral:       ["spend", "roas", "cpl", "ctr"],
  ecommerce:   ["spend", "roas", "website_purchases", "ctr"],
  leads:       ["spend", "leads", "cpl", "ctr"],
  whatsapp:    ["spend", "messaging_conversations", "cpc_conv", "ctr"],
  engajamento: ["spend", "post_engagement", "reach", "cpm"],
  trafego:     ["spend", "clicks", "cpc", "ctr"],
  seguidores:  ["spend", "follows", "reach", "impressions"],
}

function getMetricDefs(keys: MetricKey[]): MetricDef[] {
  return keys.map(k => ALL_METRIC_DEFS.find(d => d.key === k)!).filter(Boolean)
}

function loadCustomMetrics(obj: ObjectiveId): MetricKey[] | null {
  try {
    const raw = localStorage.getItem(`gtpro_metrics_${obj}`)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function saveCustomMetrics(obj: ObjectiveId, keys: MetricKey[]) {
  localStorage.setItem(`gtpro_metrics_${obj}`, JSON.stringify(keys))
}

// ─── Metrics customizer ───────────────────────────────────────────────────────

function MetricsPicker({ objective, selected, onChange }: {
  objective: ObjectiveId
  selected: MetricKey[]
  onChange: (keys: MetricKey[]) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  function toggle(key: MetricKey) {
    const next = selected.includes(key)
      ? selected.filter(k => k !== key)
      : [...selected, key]
    if (next.length === 0) return
    onChange(next)
    saveCustomMetrics(objective, next)
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] ring-1 transition-colors",
          open ? "bg-violet-600/20 ring-violet-500/40 text-violet-300" : "bg-white/[0.04] ring-white/[0.07] text-zinc-500 hover:text-zinc-300"
        )}
      >
        <SlidersHorizontal size={11} />
        Métricas
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 bg-zinc-900 ring-1 ring-white/[0.1] rounded-xl shadow-xl w-56 flex flex-col">
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Colunas da tabela</p>
          </div>
          <div className="overflow-y-auto max-h-72 px-2 space-y-0.5 scrollbar-thin">
            {ALL_METRIC_DEFS.map(def => (
              <button
                key={def.key}
                onClick={() => toggle(def.key)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors"
              >
                <span className="text-[12px] text-zinc-300">{def.label}</span>
                {selected.includes(def.key) && <Check size={11} className="text-violet-400" />}
              </button>
            ))}
          </div>
          <div className="px-2 pb-2 pt-1 border-t border-white/[0.06] mt-1">
            <button
              onClick={() => { onChange(DEFAULT_METRICS[objective]); saveCustomMetrics(objective, DEFAULT_METRICS[objective]) }}
              className="w-full text-center text-[11px] text-zinc-600 hover:text-zinc-400 py-1.5 transition-colors"
            >
              Restaurar padrão
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Objective → Meta API objective filter ────────────────────────────────────

const OBJECTIVE_META_MAP: Record<ObjectiveId, string[]> = {
  geral:       [],
  ecommerce:   ["OUTCOME_SALES", "PRODUCT_CATALOG_SALES", "CONVERSIONS"],
  leads:       ["OUTCOME_LEADS", "LEAD_GENERATION"],
  whatsapp:    ["OUTCOME_MESSAGES", "MESSAGES"],
  engajamento: ["OUTCOME_ENGAGEMENT", "POST_ENGAGEMENT", "PAGE_ENGAGEMENT", "VIDEO_VIEWS"],
  trafego:     ["OUTCOME_TRAFFIC", "LINK_CLICKS", "WEBSITE_CONVERSIONS"],
  seguidores:  ["OUTCOME_AWARENESS", "PAGE_LIKES"],
}

// Aggregates insights from campaigns filtered by objective.
// Falls back to account-level insights when no matching campaigns.
function objectiveInsights(campaigns: Campaign[], obj: ObjectiveId, fallback: Record<string, any>): Record<string, any> {
  if (obj === "geral") return fallback
  const wanted  = OBJECTIVE_META_MAP[obj]
  const subset  = campaigns.filter(c => wanted.some(w => (c.objective ?? "").toUpperCase().includes(w.toUpperCase())))
  if (subset.length === 0) return fallback

  const sumF = (key: string) => subset.reduce((a, c) => a + (Number((c.metrics as any)[key]) || 0), 0)
  const fakeAct = (val: number, ...types: string[]) =>
    val > 0 ? types.map(t => ({ action_type: t, value: String(val) })) : []

  const subImpressions = sumF("impressions")
  // If the objective's campaigns have no data this period, use account-level base metrics
  const base = subImpressions > 0
    ? { impressions: subImpressions, reach: sumF("reach"), clicks: sumF("clicks"), spend: sumF("spend") }
    : { impressions: Number(fallback.impressions ?? 0), reach: Number(fallback.reach ?? 0), clicks: Number(fallback.clicks ?? 0), spend: Number(fallback.spend ?? 0) }

  const leads   = sumF("leads")
  const convs   = sumF("conversations") || sumF("messaging_conversations")
  const engs    = sumF("engagements")
  const follows = sumF("follows")

  return {
    ...base,
    actions: [
      ...fakeAct(leads,   "lead"),
      ...fakeAct(convs,   "onsite_conversion.messaging_conversation_started_7d"),
      ...fakeAct(engs,    "post_engagement"),
      ...fakeAct(follows, "follow"),
    ],
  }
}

// ─── Dynamic funnel ───────────────────────────────────────────────────────────

function buildFunnel(obj: ObjectiveId, insights: Record<string, any>) {
  const impressions = Number(insights.impressions ?? 0)
  const reach       = Number(insights.reach ?? 0)
  const clicks      = Number(insights.clicks ?? 0)

  const act = (type: string) => {
    const found = insights.actions?.find((a: any) => a.action_type === type)
    return found ? Number(found.value) : 0
  }

  const steps: { label: string; value: number }[] = []

  switch (obj) {
    case "ecommerce": {
      const purchases = act("omni_purchase") || act("offsite_conversion.fb_pixel_purchase")
      steps.push({ label: "Impressões", value: impressions })
      if (reach > 0)     steps.push({ label: "Alcance",  value: reach })
      if (clicks > 0)    steps.push({ label: "Cliques",  value: clicks })
      if (purchases > 0) steps.push({ label: "Compras",  value: purchases })
      break
    }
    case "leads": {
      const leads = act("lead") || act("onsite_conversion.lead_grouped") || act("offsite_conversion.fb_pixel_lead")
      steps.push({ label: "Impressões", value: impressions })
      if (reach > 0)  steps.push({ label: "Alcance", value: reach })
      if (clicks > 0) steps.push({ label: "Cliques", value: clicks })
      if (leads > 0)  steps.push({ label: "Leads",   value: leads })
      break
    }
    case "whatsapp": {
      const convs = act("onsite_conversion.messaging_conversation_started_7d") || act("onsite_conversion.total_messaging_connection")
      steps.push({ label: "Impressões", value: impressions })
      if (reach > 0)  steps.push({ label: "Alcance",   value: reach })
      if (clicks > 0) steps.push({ label: "Cliques",   value: clicks })
      if (convs > 0)  steps.push({ label: "Conversas", value: convs })
      break
    }
    case "engajamento": {
      const eng = act("post_engagement")
      steps.push({ label: "Impressões", value: impressions })
      if (reach > 0) steps.push({ label: "Alcance", value: reach })
      if (eng > 0)   steps.push({ label: "Engajamentos", value: eng })
      break
    }
    case "seguidores": {
      const follows = act("follow") || act("onsite_conversion.post_follow")
      steps.push({ label: "Impressões", value: impressions })
      if (reach > 0)   steps.push({ label: "Alcance",          value: reach })
      if (follows > 0) steps.push({ label: "Novos Seguidores", value: follows })
      break
    }
    case "trafego":
      steps.push({ label: "Impressões", value: impressions })
      if (reach > 0)  steps.push({ label: "Alcance", value: reach })
      if (clicks > 0) steps.push({ label: "Cliques", value: clicks })
      break
    default: {
      const leads = act("lead") || act("onsite_conversion.lead_grouped")
      const purchases = act("omni_purchase") || act("offsite_conversion.fb_pixel_purchase")
      steps.push({ label: "Impressões", value: impressions })
      if (reach > 0)     steps.push({ label: "Alcance", value: reach })
      if (clicks > 0)    steps.push({ label: "Cliques", value: clicks })
      if (leads > 0)     steps.push({ label: "Leads", value: leads })
      if (purchases > 0) steps.push({ label: "Compras", value: purchases })
    }
  }

  return steps.filter(s => s.value > 0)
}

// ─── KPI cards per objective ──────────────────────────────────────────────────

function KpiCards({ obj, insights, totalSpend }: { obj: ObjectiveId; insights: Record<string, any>; totalSpend: number }) {
  const spend   = Number(insights.spend || totalSpend)
  const clicks  = Number(insights.clicks ?? 0)
  const reach   = Number(insights.reach ?? 0)
  const act     = (type: string) => Number(insights.actions?.find((a: any) => a.action_type === type)?.value ?? 0)
  const actVal  = (type: string) => Number(insights.action_values?.find((a: any) => a.action_type === type)?.value ?? 0)

  if (obj === "ecommerce") {
    const purchases = act("omni_purchase") || act("offsite_conversion.fb_pixel_purchase")
    const revenue   = actVal("omni_purchase") || actVal("offsite_conversion.fb_pixel_purchase")
    const roas      = insights.purchase_roas?.find((x: any) => x.action_type === "omni_purchase" || x.action_type === "offsite_conversion.fb_pixel_purchase")?.value
    return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard label="Gasto total" value={formatCurrency(spend)} highlight />
      <KpiCard label="ROAS" value={roas ? `${Number(roas).toFixed(2)}x` : "—"} />
      <KpiCard label="Receita" value={revenue > 0 ? formatCurrency(revenue) : "—"} />
      <KpiCard label="Compras" value={purchases > 0 ? purchases.toLocaleString("pt-BR") : "—"} />
    </div>
  }

  if (obj === "leads") {
    const leads = act("lead") || act("onsite_conversion.lead_grouped") || act("offsite_conversion.fb_pixel_lead")
    const cpl   = leads > 0 ? spend / leads : 0
    return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard label="Gasto total" value={formatCurrency(spend)} highlight />
      <KpiCard label="Leads" value={leads > 0 ? leads.toLocaleString("pt-BR") : "—"} />
      <KpiCard label="CPL" value={cpl > 0 ? formatCurrency(cpl) : "—"} />
      <KpiCard label="CTR" value={insights.ctr ? `${Number(insights.ctr).toFixed(2)}%` : "—"} />
    </div>
  }

  if (obj === "whatsapp") {
    const convs = act("onsite_conversion.messaging_conversation_started_7d") || act("onsite_conversion.total_messaging_connection")
    const cpc   = convs > 0 ? spend / convs : 0
    return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard label="Gasto total" value={formatCurrency(spend)} highlight />
      <KpiCard label="Conversas" value={convs > 0 ? convs.toLocaleString("pt-BR") : "—"} />
      <KpiCard label="Custo/conversa" value={cpc > 0 ? formatCurrency(cpc) : "—"} />
      <KpiCard label="Cliques" value={clicks > 0 ? clicks.toLocaleString("pt-BR") : "—"} />
    </div>
  }

  if (obj === "engajamento") {
    const eng = act("post_engagement")
    const cpe = eng > 0 ? spend / eng : 0
    return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard label="Gasto total" value={formatCurrency(spend)} highlight />
      <KpiCard label="Alcance" value={reach > 0 ? `${(reach / 1000).toFixed(1)}k` : "—"} />
      <KpiCard label="Engajamentos" value={eng > 0 ? eng.toLocaleString("pt-BR") : "—"} />
      <KpiCard label="Custo/eng." value={cpe > 0 ? formatCurrency(cpe) : "—"} />
    </div>
  }

  if (obj === "trafego") {
    return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard label="Gasto total" value={formatCurrency(spend)} highlight />
      <KpiCard label="Cliques" value={clicks > 0 ? clicks.toLocaleString("pt-BR") : "—"} />
      <KpiCard label="CPC" value={insights.cpc ? formatCurrency(Number(insights.cpc)) : "—"} />
      <KpiCard label="CTR" value={insights.ctr ? `${Number(insights.ctr).toFixed(2)}%` : "—"} />
    </div>
  }

  if (obj === "seguidores") {
    const follows = act("follow") || act("onsite_conversion.post_follow")
    const cpf     = follows > 0 ? spend / follows : 0
    return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard label="Gasto total" value={formatCurrency(spend)} highlight />
      <KpiCard label="Alcance" value={reach > 0 ? `${(reach / 1000).toFixed(1)}k` : "—"} />
      <KpiCard label="Novos Seguidores" value={follows > 0 ? follows.toLocaleString("pt-BR") : "—"} />
      <KpiCard label="Custo/seguidor" value={cpf > 0 ? formatCurrency(cpf) : "—"} />
    </div>
  }

  // geral
  const roasEntry = insights.purchase_roas?.find((x: any) => x.action_type === "omni_purchase" || x.action_type === "offsite_conversion.fb_pixel_purchase")
  const leads = act("lead") || act("onsite_conversion.lead_grouped")
  const cpl   = leads > 0 ? spend / leads : 0
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <KpiCard label="Gasto total" value={formatCurrency(spend)} highlight />
    <KpiCard label="ROAS" value={roasEntry ? `${Number(roasEntry.value).toFixed(2)}x` : "—"} />
    <KpiCard label="CPL" value={cpl > 0 ? formatCurrency(cpl) : "—"} />
    <KpiCard label="CTR" value={insights.ctr ? `${Number(insights.ctr).toFixed(2)}%` : "—"} />
  </div>
}

// ─── Google Ads View ──────────────────────────────────────────────────────────

interface GoogleCampaign {
  id: string; name: string; status: string; channel_type: string
  budget: number | null; impressions: number; clicks: number; spend: number
  conversions: number; conv_value: number; ctr: number; avg_cpc: number
  roas: number | null; cpa: number | null; currency: string
}

function GoogleCampaignsView({ preset }: { preset: string }) {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<GoogleCampaign[]>([])
  const [totals, setTotals] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toggling, setToggling] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true); setError(null)
    Promise.all([
      api.get(`/google/campaigns?date_preset=${preset}`),
      api.get(`/google/insights?date_preset=${preset}`),
    ]).then(([c, i]) => {
      setCampaigns(Array.isArray(c) ? c : [])
      setTotals(i)
      setLoading(false)
    }).catch(e => { setError(e.message); setLoading(false) })
  }, [preset])

  async function toggle(id: string, currentStatus: string) {
    const enable = currentStatus !== "ENABLED"
    setToggling(id)
    try {
      await api.patch("/google/campaigns", { campaign_id: id, status: enable ? "ENABLED" : "PAUSED" })
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: enable ? "ENABLED" : "PAUSED" } : c))
    } catch (e: any) { alert(e.message) } finally { setToggling(null) }
  }

  const fmt = (n: number, currency = "BRL") =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n)
  const fmtNum = (n: number) => n >= 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n)

  return (
    <div className="space-y-6">
      {/* KPIs */}
      {totals && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Gasto total" value={fmt(totals.spend, totals.currency)} highlight />
          <KpiCard label="ROAS" value={totals.roas ? `${totals.roas.toFixed(2)}x` : "—"} />
          <KpiCard label="Conversões" value={totals.conversions > 0 ? fmtNum(totals.conversions) : "—"} />
          <KpiCard label="CTR" value={totals.ctr ? `${(totals.ctr * 100).toFixed(2)}%` : "—"} />
        </div>
      )}

      {/* Table */}
      <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
          <p className="text-[12px] font-medium text-zinc-500">{campaigns.length} campanhas</p>
          <div className="hidden md:flex gap-5 items-center">
            {["Gasto","Cliques","Conv.","ROAS","CPA"].map(h => (
              <span key={h} className="text-[10px] text-zinc-600 uppercase tracking-wider min-w-[72px] text-right">{h}</span>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-14 text-center text-[13px] text-zinc-600">Carregando...</div>
        ) : error ? (
          <div className="px-5 py-12 flex flex-col items-center gap-4 text-center">
            <AlertTriangle size={18} className="text-amber-400" />
            {error.toLowerCase().includes("não conectada") || error.toLowerCase().includes("conecte") ? (
              <>
                <div>
                  <p className="text-[14px] font-medium text-white mb-1">Conta Google Ads não conectada</p>
                  <p className="text-[12px] text-zinc-500">Vá em <strong className="text-zinc-300">Configurações → Google Ads</strong> e conecte sua conta.</p>
                </div>
                <button onClick={() => router.push("/configuracoes?tab=google")}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-[12px] font-medium rounded-lg transition-colors">
                  <Link2 size={12} /> Conectar Google Ads <ArrowRight size={12} />
                </button>
              </>
            ) : (
              <>
                <p className="text-[13px] text-red-400">Erro ao carregar campanhas</p>
                <p className="text-[11px] text-zinc-600 max-w-sm">{error}</p>
              </>
            )}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="px-5 py-14 text-center text-[13px] text-zinc-600">Nenhuma campanha encontrada.</div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {campaigns.map(c => {
              const isActive = c.status === "ENABLED"
              return (
                <div key={c.id} className="flex items-center gap-4 px-5 py-3 hover:bg-white/[0.02] transition-colors">
                  {/* Toggle */}
                  <button onClick={() => toggle(c.id, c.status)} disabled={toggling === c.id}
                    className={cn("shrink-0 w-8 h-4 rounded-full transition-colors relative",
                      isActive ? "bg-blue-600" : "bg-zinc-700",
                      toggling === c.id && "opacity-50"
                    )}>
                    <span className={cn("pointer-events-none absolute top-0.5 left-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform",
                      isActive ? "translate-x-4" : "translate-x-0"
                    )} />
                  </button>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-zinc-200 truncate">{c.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={cn("text-[10px] font-medium", isActive ? "text-emerald-400" : "text-zinc-600")}>
                        {isActive ? "Ativa" : "Pausada"}
                      </span>
                      <span className="text-[10px] text-zinc-700">{c.channel_type?.replace("_", " ")}</span>
                      {c.budget && <span className="text-[10px] text-zinc-700">Orç: {fmt(c.budget, c.currency)}/dia</span>}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="hidden md:flex gap-5 items-center shrink-0">
                    <span className="text-[12px] text-zinc-300 min-w-[72px] text-right">{fmt(c.spend, c.currency)}</span>
                    <span className="text-[12px] text-zinc-400 min-w-[72px] text-right">{fmtNum(c.clicks)}</span>
                    <span className="text-[12px] text-zinc-400 min-w-[72px] text-right">{c.conversions > 0 ? fmtNum(c.conversions) : "—"}</span>
                    <span className="text-[12px] min-w-[72px] text-right" style={{ color: c.roas === null ? "#52525b" : c.roas >= 2 ? "#34d399" : c.roas >= 1 ? "#fbbf24" : "#f87171" }}>
                      {c.roas !== null ? `${c.roas.toFixed(2)}x` : "—"}
                    </span>
                    <span className="text-[12px] text-zinc-400 min-w-[72px] text-right">
                      {c.cpa !== null ? fmt(c.cpa, c.currency) : "—"}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CampanhasPage() {
  const router = useRouter()
  const [platform, setPlatform] = useState<"meta" | "google">("meta")
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [page, setPage] = useState(1)
  const [insights, setInsights] = useState<Record<string, any>>({})
  const [preset, setPreset] = useState("last_7d")
  const [since, setSince] = useState("")
  const [until, setUntil] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [objective, setObjective] = useState<ObjectiveId>("geral")
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(DEFAULT_METRICS["geral"])

  const isCustom   = preset === "custom"
  const customReady = isCustom && since && until && since <= until

  // Load saved metric prefs on objective change
  useEffect(() => {
    const saved = loadCustomMetrics(objective)
    setSelectedMetrics(saved ?? DEFAULT_METRICS[objective])
  }, [objective])

  useEffect(() => {
    if (isCustom && !customReady) return
    setLoading(true); setError(null)
    const insightsCall = isCustom ? api.insights.get("last_7d", since, until) : api.insights.get(preset)
    Promise.all([api.campaigns.list(preset), insightsCall])
      .then(([c, i]) => {
        setCampaigns(Array.isArray(c) ? c : [])
        setPage(1)
        setInsights(i && typeof i === "object" && !Array.isArray(i) ? i : {})
        setLoading(false)
      })
      .catch(err => { setError(err.message || "Erro ao carregar dados"); setLoading(false) })
  }, [preset, customReady ? since : null, customReady ? until : null, refreshKey])

  async function toggleCampaign(id: string, status: string) {
    const next = status === "ACTIVE" ? "PAUSED" : "ACTIVE"
    await api.campaigns.toggle(id, next)
    setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: next as Campaign["status"] } : c))
  }

  const totalSpend  = campaigns.reduce((a, c) => a + (c.metrics?.spend || 0), 0)
  const funnelData  = objectiveInsights(campaigns, objective, insights)
  const funnelSteps = buildFunnel(objective, funnelData)
  const maxVal      = funnelSteps[0]?.value || 1
  const metricDefs  = getMetricDefs(selectedMetrics)

  const filteredCampaigns = objective === "geral"
    ? campaigns
    : campaigns.filter(c => {
        const wanted = OBJECTIVE_META_MAP[objective]
        return wanted.some(w => (c.objective ?? "").toUpperCase().includes(w))
      })

  const countByObjective = (id: ObjectiveId) => {
    if (id === "geral") return campaigns.length
    const wanted = OBJECTIVE_META_MAP[id]
    return campaigns.filter(c => wanted.some(w => (c.objective ?? "").toUpperCase().includes(w))).length
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-white">Campanhas</h1>
          <div className="flex items-center gap-1 mt-2 bg-white/[0.04] rounded-lg p-0.5 ring-1 ring-white/[0.06] w-fit">
            {([{ id: "meta", label: "Meta Ads" }, { id: "google", label: "Google Ads" }] as const).map(p => (
              <button key={p.id} onClick={() => setPlatform(p.id)}
                className={cn("px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                  platform === p.id ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
                )}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 ring-1 ring-white/[0.06]">
            {PRESETS.map(p => (
              <button key={p.value} onClick={() => setPreset(p.value)}
                className={cn("px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors flex items-center gap-1.5",
                  preset === p.value ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
                )}>
                {p.value === "custom" && <Calendar size={11} />}
                {p.label}
              </button>
            ))}
          </div>
          {isCustom && (
            <div className="flex items-center gap-2">
              <input type="date" value={since} onChange={e => setSince(e.target.value)}
                className="bg-white/[0.04] ring-1 ring-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-white focus:outline-none focus:ring-violet-500/50 [color-scheme:dark]" />
              <span className="text-zinc-600 text-[12px]">até</span>
              <input type="date" value={until} onChange={e => setUntil(e.target.value)} min={since}
                className="bg-white/[0.04] ring-1 ring-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-white focus:outline-none focus:ring-violet-500/50 [color-scheme:dark]" />
            </div>
          )}
        </div>
      </div>

      {/* Google Ads view */}
      {platform === "google" && <GoogleCampaignsView preset={preset} />}

      {/* Meta Ads content */}
      {platform === "meta" && <>

      {/* Objective tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {KPI_OBJECTIVES.map(o => {
          const cnt = countByObjective(o.id)
          return (
            <button key={o.id} onClick={() => { setObjective(o.id); setPage(1) }}
              className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium transition-colors",
                objective === o.id ? "bg-violet-600 text-white" : "bg-white/[0.04] text-zinc-500 hover:text-zinc-300 ring-1 ring-white/[0.06]"
              )}>
              {o.label}
              {cnt > 0 && (
                <span className={cn("text-[10px] px-1 rounded-full",
                  objective === o.id ? "bg-white/20 text-white" : "bg-white/[0.06] text-zinc-600"
                )}>
                  {cnt}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* KPIs */}
      <KpiCards obj={objective} insights={insights} totalSpend={totalSpend} />

      {/* Funnel */}
      {funnelSteps.length >= 2 && (
        <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-5">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-5">
            Funil · {KPI_OBJECTIVES.find(o => o.id === objective)?.label}
          </p>
          <div className="flex items-end gap-2 h-20">
            {funnelSteps.map((step, i) => {
              const h    = Math.max(8, (step.value / maxVal) * 80)
              const conv = i > 0 && funnelSteps[i - 1].value > 0
                ? ((step.value / funnelSteps[i - 1].value) * 100).toFixed(1) : null
              return (
                <div key={step.label} className="flex-1 flex flex-col items-center gap-1">
                  <p className="text-[10px] text-zinc-400 font-medium">
                    {step.value >= 1000 ? `${(step.value / 1000).toFixed(1)}k` : step.value}
                  </p>
                  {conv && (
                    <p className={cn("text-[10px]", Number(conv) >= 2 ? "text-emerald-500" : "text-zinc-500")}>{conv}%</p>
                  )}
                  <div className="w-full flex flex-col justify-end" style={{ height: 56 }}>
                    <div className={cn("w-full rounded-sm", i === 0 ? "bg-violet-600/60" : "bg-violet-600/30")} style={{ height: h }} />
                  </div>
                  <p className="text-[10px] text-zinc-600 text-center leading-tight">{step.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="px-5 py-3 border-b border-white/[0.05] flex items-center justify-between">
          <p className="text-[12px] font-medium text-zinc-500">
            {filteredCampaigns.length > 0
              ? <>{filteredCampaigns.length} campanha{filteredCampaigns.length !== 1 ? "s" : ""}{objective !== "geral" && <span className="text-zinc-700"> · {KPI_OBJECTIVES.find(o => o.id === objective)?.label}</span>}</>
              : <span className="text-zinc-700">Nenhuma campanha</span>
            }
          </p>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex gap-5 items-center">
              {metricDefs.map(d => (
                <span key={d.key} className="text-[10px] text-zinc-600 uppercase tracking-wider min-w-[72px] text-right">
                  {d.label}
                </span>
              ))}
            </div>
            <MetricsPicker objective={objective} selected={selectedMetrics} onChange={setSelectedMetrics} />
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-14 text-center text-[13px] text-zinc-600">Carregando...</div>
        ) : error ? (
          <div className="px-5 py-12 flex flex-col items-center gap-4 text-center">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle size={18} className="text-amber-400" />
            </div>
            {isNotConnected(error) ? (
              <>
                <div>
                  <p className="text-[14px] font-medium text-white mb-1">Conta Meta Ads não conectada</p>
                  <p className="text-[12px] text-zinc-500 max-w-sm leading-relaxed">
                    Vá em <strong className="text-zinc-300">Configurações → Meta Ads</strong> e conecte sua conta.
                  </p>
                </div>
                <button onClick={() => router.push("/configuracoes?tab=meta")}
                  className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-medium rounded-lg transition-colors">
                  <Link2 size={12} /> Conectar Meta Ads <ArrowRight size={12} />
                </button>
              </>
            ) : isTokenExpired(error) ? (
              <>
                <div>
                  <p className="text-[14px] font-medium text-white mb-1">Token Meta Ads expirado</p>
                  <p className="text-[12px] text-zinc-500 max-w-xs">
                    Token expirado. Use um <strong className="text-zinc-300">System User Token permanente</strong>.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => router.push("/configuracoes?tab=meta")}
                    className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-medium rounded-lg transition-colors">
                    <RefreshCw size={12} /> Reconectar
                  </button>
                  <button onClick={() => router.push("/configuracoes?tab=meta")}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.09] text-zinc-300 text-[12px] font-medium rounded-lg ring-1 ring-white/[0.08] transition-colors">
                    <Key size={12} /> Token permanente
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[13px] text-red-400">Erro ao carregar campanhas</p>
                <p className="text-[11px] text-zinc-600 max-w-sm">{error}</p>
              </>
            )}
          </div>
        ) : filteredCampaigns.length === 0 ? (
          <div className="px-5 py-14 text-center text-[13px] text-zinc-600">
            {campaigns.length > 0
              ? `Nenhuma campanha com objetivo ${KPI_OBJECTIVES.find(o => o.id === objective)?.label ?? objective}.`
              : "Nenhuma campanha encontrada."
            }
          </div>
        ) : (() => {
          const pageCount = Math.ceil(filteredCampaigns.length / PAGE_SIZE)
          const paginated = filteredCampaigns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
          return (
            <>
              <div className="divide-y divide-white/[0.04]">
                {paginated.map(c => (
                  <CampaignRow key={c.id} campaign={c} onToggle={() => toggleCampaign(c.id, c.status)} metricDefs={metricDefs} />
                ))}
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.05]">
                  <p className="text-[12px] text-zinc-600">{filteredCampaigns.length} campanhas · página {page} de {pageCount}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1.5 text-[12px] text-zinc-500 hover:text-zinc-200 disabled:opacity-30 hover:bg-white/[0.04] rounded-lg transition-colors">
                      ← Anterior
                    </button>
                    {Array.from({ length: Math.min(pageCount, 7) }, (_, i) => i + 1).map(n => (
                      <button key={n} onClick={() => setPage(n)}
                        className={cn("w-7 h-7 text-[12px] rounded-lg transition-colors", n === page ? "bg-white/[0.08] text-white" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]")}>
                        {n}
                      </button>
                    ))}
                    {pageCount > 7 && <span className="text-[12px] text-zinc-700 px-1">…{pageCount}</span>}
                    <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}
                      className="px-3 py-1.5 text-[12px] text-zinc-500 hover:text-zinc-200 disabled:opacity-30 hover:bg-white/[0.04] rounded-lg transition-colors">
                      Próxima →
                    </button>
                  </div>
                </div>
              )}
            </>
          )
        })()}
      </div>

      </>}
    </div>
  )
}
