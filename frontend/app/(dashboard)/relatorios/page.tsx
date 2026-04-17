"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { FileText, Download } from "lucide-react"

interface Report {
  id: string
  title: string
  period: string
  created_at: string
  summary?: string
}

export default function RelatoriosPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Por enquanto busca do banco via API — relatórios são gerados pelo agente
    api.get("/reports").then((data) => {
      setReports(data || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Relatórios</h1>
      </div>

      {loading ? (
        <p className="text-zinc-500 text-sm">Carregando...</p>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <FileText size={40} className="text-zinc-600 mb-3" />
          <p className="text-sm font-medium text-zinc-400">Nenhum relatório ainda</p>
          <p className="text-xs mt-1">Os relatórios são gerados automaticamente pelo agente semanalmente.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div
              key={report.id}
              className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4"
            >
              <FileText size={16} className="text-violet-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-zinc-200">{report.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{report.period}</p>
              </div>
              <p className="text-xs text-zinc-600">
                {new Date(report.created_at).toLocaleDateString("pt-BR")}
              </p>
              <button className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors">
                <Download size={14} className="text-zinc-500" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
