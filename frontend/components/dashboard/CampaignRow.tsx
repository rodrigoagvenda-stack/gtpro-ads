"use client"

import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { Campaign, Metrics } from "@/types"

export type MetricKey = "spend" | "roas" | "cpl" | "ctr" | "cpc_conv" | "impressions" | "clicks" | "leads" | "cpc" | "frequency" | "conversions"

export interface MetricDef {
  key: MetricKey
  label: string
  getValue: (m: Metrics) => string
}

export const ALL_METRIC_DEFS: MetricDef[] = [
  { key: "spend",       label: "Gasto",         getValue: m => formatCurrency(m.spend ?? 0) },
  { key: "roas",        label: "ROAS",           getValue: m => m.roas != null ? `${m.roas.toFixed(2)}x` : "—" },
  { key: "cpl",         label: "CPL",            getValue: m => m.cpl != null ? formatCurrency(m.cpl) : "—" },
  { key: "ctr",         label: "CTR",            getValue: m => `${(m.ctr ?? 0).toFixed(2)}%` },
  { key: "cpc_conv",    label: "Custo/Conversa", getValue: m => m.cpc_conv != null ? formatCurrency(m.cpc_conv) : "—" },
  { key: "impressions", label: "Impressões",     getValue: m => (m.impressions ?? 0).toLocaleString("pt-BR") },
  { key: "clicks",      label: "Cliques",        getValue: m => (m.clicks ?? 0).toLocaleString("pt-BR") },
  { key: "leads",       label: "Leads",          getValue: m => m.leads != null ? m.leads.toLocaleString("pt-BR") : "—" },
  { key: "cpc",         label: "CPC",            getValue: m => m.cpc != null ? formatCurrency(m.cpc) : "—" },
  { key: "frequency",   label: "Frequência",     getValue: m => m.frequency != null ? m.frequency.toFixed(1) : "—" },
  { key: "conversions", label: "Conversões",     getValue: m => m.conversions != null ? m.conversions.toLocaleString("pt-BR") : "—" },
]

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
  const st = STATUS[campaign.status] ?? { dot: "bg-zinc-600", label: campaign.status }
  const isActive = campaign.status === "ACTIVE"
  const m = campaign.metrics ?? ({} as Metrics)

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/[0.02] transition-colors">
      <Link href={`/campanhas/${campaign.id}`} className="flex-1 min-w-0 group">
        <p className="text-[13px] font-medium text-zinc-200 truncate group-hover:text-white transition-colors">
          {campaign.name}
        </p>
        <p className="text-[11px] text-zinc-600 mt-0.5">{campaign.objective?.replace("OUTCOME_", "")}</p>
      </Link>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
        <span className="text-[12px] text-zinc-500">{st.label}</span>
      </div>

      <div className="hidden md:flex gap-5 shrink-0">
        {metricDefs.map(def => (
          <div key={def.key} className="text-right">
            <p className="text-[11px] text-zinc-600">{def.label}</p>
            <p className="text-[13px] text-zinc-300 font-medium">{def.getValue(m)}</p>
          </div>
        ))}
      </div>

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
