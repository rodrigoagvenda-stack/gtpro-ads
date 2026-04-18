"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { FileText, Download, Loader2, Plus, ChevronDown, ChevronUp, CalendarClock, MessageCircle, Check, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { cn } from "@/lib/utils"

interface Report {
  id: string
  title: string
  period: string
  summary?: string
  created_at: string
}

const SCHEDULES = [
  { id: "none",    label: "Desativado" },
  { id: "weekly",  label: "Semanal" },
  { id: "monthly", label: "Mensal" },
]

export default function RelatoriosPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [schedule, setSchedule] = useState("none")
  const [scheduleWhatsapp, setScheduleWhatsapp] = useState(false)
  const [savingSchedule, setSavingSchedule] = useState(false)
  const [savedSchedule, setSavedSchedule] = useState(false)

  useEffect(() => {
    api.reports.list().then((d) => {
      setReports(Array.isArray(d) ? d : [])
      setLoading(false)
    }).catch(() => setLoading(false))
    api.reports.getSchedule().then((d: any) => {
      setSchedule(d.report_schedule ?? "none")
      setScheduleWhatsapp(d.report_whatsapp ?? false)
    }).catch(() => {})
  }, [])

  async function saveSchedule() {
    setSavingSchedule(true)
    try {
      await api.reports.saveSchedule(schedule, scheduleWhatsapp)
      setSavedSchedule(true); setTimeout(() => setSavedSchedule(false), 3000)
    } catch (e: any) { alert(e.message) } finally { setSavingSchedule(false) }
  }

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

      {/* Schedule settings */}
      <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CalendarClock size={13} className="text-zinc-500" />
          <p className="text-[13px] font-semibold text-zinc-200">Relatórios automáticos</p>
        </div>
        <div className="flex items-center gap-2">
          {SCHEDULES.map(s => (
            <button key={s.id} onClick={() => { setSchedule(s.id); setSavedSchedule(false) }}
              className={cn("px-3 py-1.5 rounded-lg text-[12px] font-medium ring-1 transition-colors",
                schedule === s.id ? "bg-violet-500/15 ring-violet-500/30 text-violet-300" : "bg-white/[0.03] ring-white/[0.07] text-zinc-500 hover:text-zinc-300"
              )}>
              {s.label}
            </button>
          ))}
        </div>
        {schedule !== "none" && (
          <div className="flex items-center justify-between bg-white/[0.02] ring-1 ring-white/[0.06] rounded-lg px-4 py-3">
            <div className="flex items-center gap-2.5">
              <MessageCircle size={13} className="text-zinc-500" />
              <div>
                <p className="text-[13px] text-zinc-200">Enviar por WhatsApp</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">Requer WhatsApp configurado</p>
              </div>
            </div>
            <button type="button" onClick={() => { setScheduleWhatsapp(v => !v); setSavedSchedule(false) }}
              className={cn("shrink-0 w-11 h-6 rounded-full transition-colors relative", scheduleWhatsapp ? "bg-violet-600" : "bg-zinc-700")}>
              <span className={cn("pointer-events-none absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", scheduleWhatsapp ? "translate-x-5" : "translate-x-0")} />
            </button>
          </div>
        )}
        <button onClick={saveSchedule} disabled={savingSchedule}
          className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.09] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg ring-1 ring-white/[0.08] transition-colors">
          {savedSchedule ? <><Check size={13} className="text-emerald-400" /> Salvo</> : savingSchedule ? <><RefreshCw size={13} className="animate-spin" /> Salvando...</> : "Salvar agendamento"}
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
