import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown } from "lucide-react"

interface KpiCardProps {
  label: string
  value: string
  trend?: number
  description?: string
  highlight?: boolean
}

export default function KpiCard({ label, value, trend, description, highlight }: KpiCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg px-5 py-4",
        highlight
          ? "bg-violet-600/10 ring-1 ring-violet-500/20"
          : "bg-white/[0.03] ring-1 ring-white/[0.06]"
      )}
    >
      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-[0.08em]">{label}</p>
      <p className="mt-2.5 text-[22px] font-semibold text-white leading-none tracking-tight">{value}</p>
      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1">
          {trend > 0
            ? <TrendingUp size={10} className="text-emerald-500" />
            : <TrendingDown size={10} className="text-red-400" />}
          <span className={cn("text-[11px] font-medium", trend > 0 ? "text-emerald-500" : "text-red-400")}>
            {trend > 0 ? "+" : ""}{trend.toFixed(1)}%
          </span>
        </div>
      )}
      {description && <p className="mt-1 text-[11px] text-zinc-600">{description}</p>}
    </div>
  )
}
