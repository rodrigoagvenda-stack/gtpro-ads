"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { AlertTriangle, CheckCircle, X } from "lucide-react"
import type { Alert } from "@/types"

const ALERT_ICONS: Record<string, string> = {
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
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-white">Alertas</h1>

      {loading ? (
        <p className="text-zinc-500 text-sm">Carregando...</p>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <CheckCircle size={40} className="text-emerald-500 mb-3" />
          <p className="text-sm font-medium text-zinc-300">Nenhum alerta ativo</p>
          <p className="text-xs mt-1">Todas as campanhas estão dentro dos parâmetros configurados.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="flex items-start gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4"
            >
              <AlertTriangle size={16} className="text-yellow-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200">
                  {ALERT_ICONS[alert.type] ?? alert.type}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">{alert.message}</p>
                <p className="text-xs text-zinc-600 mt-1">
                  {new Date(alert.created_at).toLocaleString("pt-BR")}
                </p>
              </div>
              <button
                onClick={() => resolve(alert.id)}
                className="shrink-0 p-1 hover:bg-zinc-800 rounded-md transition-colors"
                title="Marcar como resolvido"
              >
                <X size={14} className="text-zinc-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
