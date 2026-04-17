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
    api.reports.list().then((d) => {
      setReports(Array.isArray(d) ? d : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function generateReport() {
    setGenerating(true)
    try {
      const report = await api.reports.generate()
      setReports((p) => [report, ...p])
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
    if (!res.ok) return alert("Erro ao baixar")
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `relatorio-${id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-white">Relatórios</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5">Gerados automaticamente pelo agente</p>
        </div>
        <button
          onClick={generateReport}
          disabled={generating}
          className="flex items-center gap-2 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-colors"
        >
          {generating ? <><Loader2 size={13} className="animate-spin" /> Gerando...</> : <><Plus size={13} /> Gerar relatório</>}
        </button>
      </div>

      {generating && (
        <div className="bg-violet-600/[0.08] ring-1 ring-violet-500/20 rounded-lg px-4 py-3 flex items-center gap-2.5 text-[13px] text-violet-300">
          <Loader2 size={13} className="animate-spin shrink-0" />
          O agente está analisando suas campanhas...
        </div>
      )}

      {loading ? (
        <p className="text-[13px] text-zinc-600">Carregando...</p>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <div className="w-10 h-10 rounded-full bg-white/[0.04] flex items-center justify-center">
            <FileText size={18} className="text-zinc-600" />
          </div>
          <div className="text-center">
            <p className="text-[13px] text-zinc-400">Nenhum relatório ainda</p>
            <p className="text-[12px] text-zinc-600 mt-0.5">Clique em "Gerar relatório" para criar o primeiro.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <div key={report.id} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-7 h-7 rounded-lg bg-violet-600/15 flex items-center justify-center shrink-0">
                  <FileText size={13} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-zinc-200">{report.title}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{report.period}</p>
                </div>
                <p className="text-[11px] text-zinc-700 shrink-0">
                  {new Date(report.created_at).toLocaleDateString("pt-BR")}
                </p>
                <button onClick={() => downloadReport(report.id)} className="w-7 h-7 flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-colors" title="Baixar CSV">
                  <Download size={13} className="text-zinc-600 hover:text-zinc-300" />
                </button>
                {report.summary && (
                  <button onClick={() => setExpanded(expanded === report.id ? null : report.id)} className="w-7 h-7 flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-colors">
                    {expanded === report.id ? <ChevronUp size={13} className="text-zinc-600" /> : <ChevronDown size={13} className="text-zinc-600" />}
                  </button>
                )}
              </div>
              {expanded === report.id && report.summary && (
                <div className="px-5 pb-5 border-t border-white/[0.05] pt-4">
                  <p className="text-[12px] text-zinc-500 whitespace-pre-wrap leading-relaxed">{report.summary}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
