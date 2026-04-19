"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { AlertTriangle, CheckCircle, X, RefreshCw, Zap } from "lucide-react"
import type { Alert } from "@/types"
import { cn } from "@/lib/utils"

const ALERT_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  roas_baixo:        { label: "ROAS abaixo do mínimo",    color: "text-amber-400",  bg: "bg-amber-500/10" },
  cpl_alto:          { label: "CPL acima do limite",       color: "text-red-400",    bg: "bg-red-500/10" },
  budget_esgotado:   { label: "Budget esgotado",           color: "text-orange-400", bg: "bg-orange-500/10" },
  campanha_rejeitada:{ label: "Campanha rejeitada",        color: "text-red-400",    bg: "bg-red-500/10" },
  queda_performance: { label: "Queda de performance",      color: "text-amber-400",  bg: "bg-amber-500/10" },
  sem_entrega:       { label: "Sem entrega",               color: "text-zinc-400",   bg: "bg-white/[0.04]" },
}

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading]   = useState(true)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ checked: number; created: number } | null>(null)

  async function load() {
    setLoading(true)
    api.alerts.list("active").then((data) => { setAlerts(data); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  async function resolve(id: string) {
    await api.alerts.resolve(id)
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  async function checkAlerts() {
    setChecking(true)
    setCheckResult(null)
    try {
      const res = await api.post("/alerts/check", {})
      setCheckResult(res)
      await load()
    } catch { } finally { setChecking(false) }
  }

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-white">Alertas</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5">Campanhas que precisam de atenção</p>
        </div>
        <button onClick={checkAlerts} disabled={checking}
          className="flex items-center gap-2 px-3.5 py-2 bg-white/[0.06] hover:bg-white/[0.09] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg ring-1 ring-white/[0.08] transition-colors">
          {checking ? <RefreshCw size={13} className="animate-spin" /> : <Zap size={13} className="text-violet-400" />}
          {checking ? "Verificando..." : "Verificar agora"}
        </button>
      </div>

      {checkResult && (
        <div className={cn("flex items-center gap-2 text-[12px] rounded-lg px-4 py-3 ring-1",
          checkResult.created > 0
            ? "bg-amber-500/10 ring-amber-500/20 text-amber-300"
            : "bg-emerald-500/10 ring-emerald-500/20 text-emerald-300"
        )}>
          {checkResult.created > 0
            ? `${checkResult.created} novo${checkResult.created > 1 ? "s" : ""} alerta${checkResult.created > 1 ? "s" : ""} encontrado${checkResult.created > 1 ? "s" : ""} em ${checkResult.checked} campanhas ativas.`
            : `Tudo certo — nenhum problema encontrado em ${checkResult.checked} campanhas ativas.`
          }
        </div>
      )}

      {loading ? (
        <p className="text-[13px] text-zinc-600">Carregando...</p>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle size={18} className="text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-medium text-zinc-300">Tudo certo</p>
            <p className="text-[12px] text-zinc-600 mt-0.5">Clique em "Verificar agora" para checar suas campanhas ativas.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const meta = ALERT_LABELS[alert.type] ?? { label: alert.type, color: "text-amber-400", bg: "bg-amber-500/10" }
            return (
              <div key={alert.id} className="flex items-start gap-4 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl px-5 py-4">
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5", meta.bg)}>
                  <AlertTriangle size={13} className={meta.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-zinc-200">{meta.label}</p>
                  <p className="text-[12px] text-zinc-500 mt-0.5 leading-relaxed">{alert.message}</p>
                  <p className="text-[11px] text-zinc-700 mt-1.5">{new Date(alert.created_at).toLocaleString("pt-BR")}</p>
                </div>
                <button onClick={() => resolve(alert.id)}
                  className="shrink-0 w-7 h-7 flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-colors"
                  title="Marcar como resolvido">
                  <X size={13} className="text-zinc-600 hover:text-zinc-300" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
