"use client"

import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { Campaign, Metrics } from "@/types"

export type MetricKey =
  | "spend" | "roas" | "cpl" | "ctr" | "cpc_conv" | "impressions" | "clicks"
  | "leads" | "cpc" | "frequency" | "conversions" | "reach" | "cpm" | "cpp"
  | "unique_clicks" | "unique_ctr" | "outbound_clicks" | "outbound_clicks_ctr"
  | "inline_link_clicks" | "inline_link_click_ctr" | "cost_per_unique_click"
  | "video_p25_watched" | "video_p50_watched" | "video_p75_watched"
  | "video_p100_watched" | "video_avg_time_watched"
  | "post_engagement" | "page_engagement" | "page_likes" | "follows"
  | "website_purchases" | "website_purchase_value" | "messaging_conversations"
  | "social_spend" | "canvas_avg_view_time" | "canvas_avg_view_percent"

export interface MetricDef {
  key: MetricKey
  label: string
  getValue: (m: Metrics) => string
}

export const ALL_METRIC_DEFS: MetricDef[] = [
  // Custos
  { key: "spend",                label: "Gasto",                getValue: m => formatCurrency(m.spend ?? 0) },
  { key: "social_spend",         label: "Gasto Social",         getValue: m => m.social_spend != null ? formatCurrency(m.social_spend) : "—" },
  { key: "cpm",                  label: "CPM",                  getValue: m => (m.cpm ?? 0) > 0 ? formatCurrency(m.cpm!) : "—" },
  { key: "cpp",                  label: "CPP",                  getValue: m => m.cpp != null ? formatCurrency(m.cpp) : "—" },
  { key: "cpc",                  label: "CPC",                  getValue: m => (m.cpc ?? 0) > 0 ? formatCurrency(m.cpc!) : "—" },
  { key: "cost_per_unique_click",label: "CPC Único",            getValue: m => m.cost_per_unique_click != null ? formatCurrency(m.cost_per_unique_click) : "—" },
  { key: "cpl",                  label: "CPL",                  getValue: m => m.cpl != null ? formatCurrency(m.cpl) : "—" },
  { key: "cpc_conv",             label: "Custo/Conversa",       getValue: m => m.cpc_conv != null ? formatCurrency(m.cpc_conv) : "—" },
  // Resultados
  { key: "roas",                 label: "ROAS",                 getValue: m => m.roas != null ? `${m.roas.toFixed(2)}x` : "—" },
  { key: "conversions",          label: "Conversões",           getValue: m => m.conversions != null ? m.conversions.toLocaleString("pt-BR") : "—" },
  { key: "leads",                label: "Leads",                getValue: m => m.leads != null ? m.leads.toLocaleString("pt-BR") : "—" },
  { key: "website_purchases",    label: "Compras",              getValue: m => m.website_purchases != null ? m.website_purchases.toLocaleString("pt-BR") : "—" },
  { key: "website_purchase_value",label:"Valor de Compras",     getValue: m => m.website_purchase_value != null ? formatCurrency(m.website_purchase_value) : "—" },
  { key: "messaging_conversations",label:"Conversas",           getValue: m => m.messaging_conversations != null ? m.messaging_conversations.toLocaleString("pt-BR") : "—" },
  { key: "follows",              label: "Seguidores",           getValue: m => m.follows != null ? m.follows.toLocaleString("pt-BR") : "—" },
  { key: "page_likes",           label: "Curtidas Pág.",        getValue: m => m.page_likes != null ? m.page_likes.toLocaleString("pt-BR") : "—" },
  // Alcance e exposição
  { key: "impressions",          label: "Impressões",           getValue: m => (m.impressions ?? 0).toLocaleString("pt-BR") },
  { key: "reach",                label: "Alcance",              getValue: m => (m.reach ?? 0) > 0 ? `${((m.reach ?? 0) / 1000).toFixed(1)}k` : "—" },
  { key: "frequency",            label: "Frequência",           getValue: m => m.frequency != null ? m.frequency.toFixed(1) : "—" },
  // Cliques
  { key: "clicks",               label: "Cliques",              getValue: m => (m.clicks ?? 0).toLocaleString("pt-BR") },
  { key: "unique_clicks",        label: "Cliques Únicos",       getValue: m => m.unique_clicks != null ? m.unique_clicks.toLocaleString("pt-BR") : "—" },
  { key: "outbound_clicks",      label: "Cliques Outbound",     getValue: m => m.outbound_clicks != null ? m.outbound_clicks.toLocaleString("pt-BR") : "—" },
  { key: "inline_link_clicks",   label: "Cliques no Link",      getValue: m => m.inline_link_clicks != null ? m.inline_link_clicks.toLocaleString("pt-BR") : "—" },
  // Taxas
  { key: "ctr",                  label: "CTR",                  getValue: m => (m.ctr ?? 0) > 0 ? `${(m.ctr ?? 0).toFixed(2)}%` : "—" },
  { key: "unique_ctr",           label: "CTR Único",            getValue: m => m.unique_ctr != null ? `${m.unique_ctr.toFixed(2)}%` : "—" },
  { key: "outbound_clicks_ctr",  label: "CTR Outbound",         getValue: m => m.outbound_clicks_ctr != null ? `${m.outbound_clicks_ctr.toFixed(2)}%` : "—" },
  { key: "inline_link_click_ctr",label: "CTR Link",             getValue: m => m.inline_link_click_ctr != null ? `${m.inline_link_click_ctr.toFixed(2)}%` : "—" },
  // Engajamento
  { key: "post_engagement",      label: "Engajamentos",         getValue: m => m.post_engagement != null ? m.post_engagement.toLocaleString("pt-BR") : "—" },
  { key: "page_engagement",      label: "Engaj. Página",        getValue: m => m.page_engagement != null ? m.page_engagement.toLocaleString("pt-BR") : "—" },
  // Vídeo
  { key: "video_p25_watched",    label: "Vídeo 25%",            getValue: m => m.video_p25_watched != null ? m.video_p25_watched.toLocaleString("pt-BR") : "—" },
  { key: "video_p50_watched",    label: "Vídeo 50%",            getValue: m => m.video_p50_watched != null ? m.video_p50_watched.toLocaleString("pt-BR") : "—" },
  { key: "video_p75_watched",    label: "Vídeo 75%",            getValue: m => m.video_p75_watched != null ? m.video_p75_watched.toLocaleString("pt-BR") : "—" },
  { key: "video_p100_watched",   label: "Vídeo 100%",           getValue: m => m.video_p100_watched != null ? m.video_p100_watched.toLocaleString("pt-BR") : "—" },
  { key: "video_avg_time_watched",label:"Tempo Médio Vídeo",    getValue: m => m.video_avg_time_watched != null ? `${m.video_avg_time_watched.toFixed(1)}s` : "—" },
  // Canvas / Instant Experience
  { key: "canvas_avg_view_time", label: "Canvas Tempo Médio",   getValue: m => m.canvas_avg_view_time != null ? `${m.canvas_avg_view_time.toFixed(1)}s` : "—" },
  { key: "canvas_avg_view_percent",label:"Canvas % Visto",      getValue: m => m.canvas_avg_view_percent != null ? `${m.canvas_avg_view_percent.toFixed(1)}%` : "—" },
]

// ─── Objective badge config ───────────────────────────────────────────────────

const OBJ_LABEL: Record<string, string> = {
  OUTCOME_SALES:         "Vendas",
  OUTCOME_LEADS:         "Leads",
  OUTCOME_ENGAGEMENT:    "Engajamento",
  OUTCOME_TRAFFIC:       "Tráfego",
  OUTCOME_AWARENESS:     "Alcance",
  MESSAGES:              "WhatsApp",
  LEAD_GENERATION:       "Leads",
  POST_ENGAGEMENT:       "Engajamento",
  PAGE_LIKES:            "Seguidores",
  LINK_CLICKS:           "Tráfego",
  VIDEO_VIEWS:           "Vídeo",
  PRODUCT_CATALOG_SALES: "Catálogo",
  CONVERSIONS:           "Conversões",
}

const OBJ_COLOR: Record<string, string> = {
  OUTCOME_SALES:         "bg-emerald-500/10 text-emerald-400",
  OUTCOME_LEADS:         "bg-blue-500/10 text-blue-400",
  OUTCOME_ENGAGEMENT:    "bg-orange-500/10 text-orange-400",
  OUTCOME_TRAFFIC:       "bg-violet-500/10 text-violet-400",
  OUTCOME_AWARENESS:     "bg-pink-500/10 text-pink-400",
  MESSAGES:              "bg-teal-500/10 text-teal-400",
  LEAD_GENERATION:       "bg-blue-500/10 text-blue-400",
  POST_ENGAGEMENT:       "bg-orange-500/10 text-orange-400",
  PAGE_LIKES:            "bg-pink-500/10 text-pink-400",
  LINK_CLICKS:           "bg-violet-500/10 text-violet-400",
  CONVERSIONS:           "bg-emerald-500/10 text-emerald-400",
  PRODUCT_CATALOG_SALES: "bg-emerald-500/10 text-emerald-400",
  VIDEO_VIEWS:           "bg-amber-500/10 text-amber-400",
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface CampaignRowProps {
  campaign: Campaign
  onToggle: () => void
  metricDefs?: MetricDef[]
}

const STATUS: Record<string, { dot: string; label: string }> = {
  ACTIVE:      { dot: "bg-emerald-500", label: "Ativo" },
  PAUSED:      { dot: "bg-zinc-600",    label: "Pausado" },
  WITH_ISSUES: { dot: "bg-red-500",     label: "Com problemas" },
  IN_PROCESS:  { dot: "bg-amber-500",   label: "Em revisão" },
}

const DEFAULT_DEFS = ALL_METRIC_DEFS.filter(d => ["spend", "roas", "cpl", "ctr"].includes(d.key))

export default function CampaignRow({ campaign, onToggle, metricDefs = DEFAULT_DEFS }: CampaignRowProps) {
  const st      = STATUS[campaign.status] ?? { dot: "bg-zinc-600", label: campaign.status }
  const isActive = campaign.status === "ACTIVE"
  const m        = campaign.metrics ?? ({} as Metrics)
  const obj      = campaign.objective ?? ""
  const objLabel = OBJ_LABEL[obj] ?? obj.replace("OUTCOME_", "")
  const objColor = OBJ_COLOR[obj] ?? "bg-zinc-800/60 text-zinc-500"

  const budget = campaign.daily_budget
    ? `R$${campaign.daily_budget.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/dia`
    : campaign.lifetime_budget
    ? `R$${campaign.lifetime_budget.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} total`
    : null

  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/[0.025] transition-colors group">

      {/* Status dot */}
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", st.dot)} />

      {/* Name + meta */}
      <Link href={`/campanhas/${campaign.id}`} className="flex-1 min-w-0">
        <p className="text-[13px] font-medium text-zinc-200 truncate group-hover:text-white transition-colors leading-snug">
          {campaign.name}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wide", objColor)}>
            {objLabel}
          </span>
          {budget && (
            <span className="text-[11px] text-zinc-600">{budget}</span>
          )}
          <span className="text-[11px] text-zinc-700">{st.label}</span>
        </div>
      </Link>

      {/* Metric columns */}
      <div className="hidden md:flex items-center gap-5 shrink-0">
        {metricDefs.map(def => (
          <div key={def.key} className="text-right min-w-[72px]">
            <p className="text-[13px] text-zinc-200 font-medium tabular-nums">{def.getValue(m)}</p>
          </div>
        ))}
      </div>

      {/* Toggle */}
      <button
        onClick={onToggle}
        className={cn("shrink-0 w-9 h-5 rounded-full transition-colors relative", isActive ? "bg-violet-600" : "bg-zinc-800")}
        title={isActive ? "Pausar" : "Ativar"}
      >
        <span className={cn("absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", isActive ? "translate-x-[18px]" : "translate-x-0")} />
      </button>
    </div>
  )
}
