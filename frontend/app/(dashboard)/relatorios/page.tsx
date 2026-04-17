"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { FileText, Download, Loader2, Plus, ChevronDown, ChevronUp } from "lucide-react"
import { createClient } from "@/lib/supabase"

interface Report {
  id: string
  title: string
  period: string
  summary?: string
  created_at: string
}

export default function RelatoriosPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    api.reports.list().then((data) => {
      setReports(Array.isArray(data) ? data : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function generateReport() {
    setGenerating(true)
    try {
      const report = await api.reports.generate()
      setReports((prev) => [report, ...prev])
      setExpanded(report.id)
    } catch (e: any) {
      alert(e.message || "Erro ao gerar relatório")
    } finally {
      setGenerating(false)
    }
  }

  async function downloadReport(id: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch(api.reports.downloadUrl(id), {
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
    })
    if (!res.ok) return alert("Erro ao baixar relatório")
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `relatorio-${id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-white">Relatórios</h1>
        <button
          onClick={generateReport}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {generating ? (
            <><Loader2 size={14} className="animate-spin" /> Gerando...</>
          ) : (
            <><Plus size={14} /> Gerar relatório</>
          )}
        </button>
      </div>

      {generating && (
        <div className="bg-violet-600/10 border border-violet-600/30 rounded-lg px-4 py-3 text-sm text-violet-400 flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" />
          O agente está analisando suas campanhas. Isso pode levar alguns segundos...
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500 text-sm">Carregando...</p>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
          <FileText size={40} className="text-zinc-600 mb-3" />
          <p className="text-sm font-medium text-zinc-400">Nenhum relatório ainda</p>
          <p className="text-xs mt-1">Clique em "Gerar relatório" para criar o primeiro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                <FileText size={16} className="text-violet-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-zinc-200">{report.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{report.period}</p>
                </div>
                <p className="text-xs text-zinc-600 shrink-0">
                  {new Date(report.created_at).toLocaleDateString("pt-BR")}
                </p>
                <button
                  onClick={() => downloadReport(report.id)}
                  className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors"
                  title="Baixar CSV"
                >
                  <Download size={14} className="text-zinc-500" />
                </button>
                {report.summary && (
                  <button
                    onClick={() => setExpanded(expanded === report.id ? null : report.id)}
                    className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors"
                  >
                    {expanded === report.id
                      ? <ChevronUp size={14} className="text-zinc-500" />
                      : <ChevronDown size={14} className="text-zinc-500" />}
                  </button>
                )}
              </div>
              {expanded === report.id && report.summary && (
                <div className="px-5 pb-5 border-t border-zinc-800 pt-4">
                  <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">{report.summary}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
