"use client"

import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { Campaign } from "@/types"

interface CampaignRowProps {
  campaign: Campaign
  onToggle: () => void
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: "Ativo", color: "bg-emerald-500/20 text-emerald-400" },
  PAUSED: { label: "Pausado", color: "bg-zinc-700 text-zinc-400" },
  WITH_ISSUES: { label: "Com problemas", color: "bg-red-500/20 text-red-400" },
  IN_PROCESS: { label: "Em revisão", color: "bg-yellow-500/20 text-yellow-400" },
}

export default function CampaignRow({ campaign, onToggle }: CampaignRowProps) {
  const statusInfo = STATUS_LABELS[campaign.status] ?? { label: campaign.status, color: "bg-zinc-700 text-zinc-400" }
  const isActive = campaign.status === "ACTIVE"

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-zinc-800/50 transition-colors">
      <Link href={`/campanhas/${campaign.id}`} className="flex-1 min-w-0 group">
        <p className="text-sm font-medium text-zinc-100 truncate group-hover:text-violet-300 transition-colors">{campaign.name}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{campaign.objective?.replace("OUTCOME_", "")}</p>
      </Link>

      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", statusInfo.color)}>
        {statusInfo.label}
      </span>

      <div className="hidden md:flex gap-6 text-right text-xs">
        <div>
          <p className="text-zinc-500">Gasto</p>
          <p className="text-zinc-200 font-medium">{formatCurrency(campaign.metrics?.spend || 0)}</p>
        </div>
        {campaign.metrics?.roas && (
          <div>
            <p className="text-zinc-500">ROAS</p>
            <p className="text-zinc-200 font-medium">{campaign.metrics.roas.toFixed(2)}x</p>
          </div>
        )}
        {campaign.metrics?.cpl && (
          <div>
            <p className="text-zinc-500">CPL</p>
            <p className="text-zinc-200 font-medium">{formatCurrency(campaign.metrics.cpl)}</p>
          </div>
        )}
        <div>
          <p className="text-zinc-500">CTR</p>
          <p className="text-zinc-200 font-medium">{(campaign.metrics?.ctr || 0).toFixed(2)}%</p>
        </div>
      </div>

      <button
        onClick={onToggle}
        className={cn(
          "shrink-0 w-10 h-6 rounded-full transition-colors relative",
          isActive ? "bg-violet-600" : "bg-zinc-700"
        )}
        title={isActive ? "Pausar campanha" : "Ativar campanha"}
      >
        <span
          className={cn(
            "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
            isActive ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
    </div>
  )
}
