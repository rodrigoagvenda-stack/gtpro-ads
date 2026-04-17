import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface KpiCardProps {
  label: string
  value: string
  trend?: number
  description?: string
  highlight?: boolean
}

export default function KpiCard({ label, value, trend, description, highlight }: KpiCardProps) {
  const trendPositive = trend !== undefined && trend > 0
  const trendNegative = trend !== undefined && trend < 0

  return (
    <div
      className={cn(
        "rounded-xl p-5 border",
        highlight
          ? "bg-violet-600/10 border-violet-500/30"
          : "bg-zinc-900 border-zinc-800"
      )}
    >
      <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {trend !== undefined && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          {trendPositive && <TrendingUp size={12} className="text-emerald-400" />}
          {trendNegative && <TrendingDown size={12} className="text-red-400" />}
          {!trendPositive && !trendNegative && <Minus size={12} className="text-zinc-500" />}
          <span
            className={cn(
              trendPositive && "text-emerald-400",
              trendNegative && "text-red-400",
              !trendPositive && !trendNegative && "text-zinc-500"
            )}
          >
            {trend > 0 ? "+" : ""}{trend.toFixed(1)}% vs período anterior
          </span>
        </div>
      )}
      {description && <p className="mt-1 text-xs text-zinc-500">{description}</p>}
    </div>
  )
}
