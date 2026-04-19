"use client"

import Link from "next/link"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import type { Campaign } from "@/types"

interface CampaignRowProps {
  campaign: Campaign
  onToggle: () => void
}

const STATUS: Record<string, { dot: string; label: string }> = {
  ACTIVE: { dot: "bg-emerald-500", label: "Ativo" },
  PAUSED: { dot: "bg-zinc-600", label: "Pausado" },
  WITH_ISSUES: { dot: "bg-red-500", label: "Com problemas" },
  IN_PROCESS: { dot: "bg-amber-500", label: "Em revisão" },
}

export default function CampaignRow({ campaign, onToggle }: CampaignRowProps) {
  const st = STATUS[campaign.status] ?? { dot: "bg-zinc-600", label: campaign.status }
  const isActive = campaign.status === "ACTIVE"

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
        <div className="text-right">
          <p className="text-[11px] text-zinc-600">Gasto</p>
          <p className="text-[13px] text-zinc-300 font-medium">{formatCurrency(campaign.metrics?.spend || 0)}</p>
        </div>
        {campaign.metrics?.roas != null && (
          <div className="text-right">
            <p className="text-[11px] text-zinc-600">ROAS</p>
            <p className="text-[13px] text-zinc-300 font-medium">{campaign.metrics.roas.toFixed(2)}x</p>
          </div>
        )}
        {campaign.metrics?.cpl != null && (
          <div className="text-right">
            <p className="text-[11px] text-zinc-600">CPL</p>
            <p className="text-[13px] text-zinc-300 font-medium">{formatCurrency(campaign.metrics.cpl)}</p>
          </div>
        )}
        <div className="text-right">
          <p className="text-[11px] text-zinc-600">CTR</p>
          <p className="text-[13px] text-zinc-300 font-medium">{(campaign.metrics?.ctr || 0).toFixed(2)}%</p>
        </div>
      </div>

      <button
        onClick={onToggle}
        className={cn(
          "shrink-0 w-9 h-5 rounded-full transition-colors relative",
          isActive ? "bg-violet-600" : "bg-zinc-800"
        )}
        title={isActive ? "Pausar" : "Ativar"}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
            isActive ? "translate-x-[18px]" : "translate-x-0"
          )}
        />
      </button>
    </div>
  )
}
