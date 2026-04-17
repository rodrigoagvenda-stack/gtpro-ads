"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { AlertTriangle, CheckCircle, X } from "lucide-react"
import type { Alert } from "@/types"

const ALERT_LABELS: Record<string, string> = {
  roas_baixo: "ROAS abaixo do mínimo",
  cpl_alto: "CPL acima do limite",
  budget_esgotado: "Budget esgotado",
  campanha_rejeitada: "Campanha rejeitada",
  queda_performance: "Queda de performance",
}

export default function AlertasPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.alerts.list("active").then((data) => {
      setAlerts(data)
      setLoading(false)
    })
  }, [])

  async function resolve(id: string) {
    await api.alerts.resolve(id)
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-[17px] font-semibold text-white">Alertas</h1>
        <p className="text-[12px] text-zinc-600 mt-0.5">Campanhas que precisam de atenção</p>
      </div>

      {loading ? (
        <p className="text-[13px] text-zinc-600">Carregando...</p>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle size={18} className="text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="text-[13px] font-medium text-zinc-300">Tudo certo</p>
            <p className="text-[12px] text-zinc-600 mt-0.5">Nenhum alerta ativo no momento.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-4 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl px-5 py-4"
            >
              <div className="w-7 h-7 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <AlertTriangle size={13} className="text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-zinc-200">
                  {ALERT_LABELS[alert.type] ?? alert.type}
                </p>
                <p className="text-[12px] text-zinc-500 mt-0.5 leading-relaxed">{alert.message}</p>
                <p className="text-[11px] text-zinc-700 mt-1.5">
                  {new Date(alert.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <button
                onClick={() => resolve(alert.id)}
                className="shrink-0 w-7 h-7 flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-colors"
                title="Marcar como resolvido"
              >
                <X size={13} className="text-zinc-600 hover:text-zinc-300" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
