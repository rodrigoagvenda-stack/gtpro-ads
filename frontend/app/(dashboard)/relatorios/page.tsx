"use client"

import React, { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { FileText, Download, Loader2, Plus, ChevronDown, ChevronUp, CalendarClock,
  MessageCircle, Check, RefreshCw, X, AlertTriangle, TrendingDown,
  Pencil, Users, DollarSign, Sparkles, ChevronRight } from "lucide-react"
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

const SKILLS: { id: string; label: string; desc: string; icon: any; color: string }[] = [
  { id: "gargalos", label: "Gargalos",  desc: "Aponta onde o funil quebra",        icon: AlertTriangle, color: "text-red-400   bg-red-500/10   ring-red-500/20" },
  { id: "criativo", label: "Criativo",  desc: "CTR, frequência e saturação",        icon: TrendingDown,  color: "text-violet-400 bg-violet-500/10 ring-violet-500/20" },
  { id: "copy",     label: "Copy",      desc: "Mensagem e taxa de conversão",       icon: Pencil,        color: "text-blue-400  bg-blue-500/10   ring-blue-500/20" },
  { id: "publico",  label: "Público",   desc: "Qualidade e sobreposição de público", icon: Users,         color: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20" },
  { id: "budget",   label: "Budget",    desc: "Redistribuição de orçamento",        icon: DollarSign,    color: "text-amber-400  bg-amber-500/10  ring-amber-500/20" },
]

// ─── Markdown → HTML for PDF ──────────────────────────────────────────────────

function inlineHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
}

function isTableLine(line: string) { const t = line.trim(); return t.startsWith("|") && t.endsWith("|") }
function isSepLine(line: string)   { return /^\|[\s\-:|]+\|$/.test(line.trim()) }
function splitRow(line: string)    { return line.trim().split("|").slice(1, -1).map(c => c.trim()) }

type Seg = { type: "lines"; lines: string[] } | { type: "table"; rows: string[][] } | { type: "code"; lines: string[] }

function segmentMd(md: string): Seg[] {
  const lines = md.split("\n")
  const segs: Seg[] = []
  let i = 0
  while (i < lines.length) {
    if (lines[i].trimStart().startsWith("```")) {
      const codeLines: string[] = []
      i++ // skip opening ```
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i])
        i++
      }
      i++ // skip closing ```
      if (codeLines.length > 0) segs.push({ type: "code", lines: codeLines })
    } else if (isTableLine(lines[i])) {
      const rows: string[][] = []
      while (i < lines.length && isTableLine(lines[i])) {
        if (!isSepLine(lines[i])) rows.push(splitRow(lines[i]))
        i++
      }
      if (rows.length > 0) segs.push({ type: "table", rows })
    } else {
      const last = segs[segs.length - 1]
      if (last?.type === "lines") last.lines.push(lines[i])
      else segs.push({ type: "lines", lines: [lines[i]] })
      i++
    }
  }
  return segs
}

function mdToHtml(md: string): string {
  const segs = segmentMd(md)
  const result: string[] = []

  for (const seg of segs) {
    if (seg.type === "code") {
      result.push(`<pre style="background:#F3F4F6;padding:12px 16px;border-radius:8px;font-family:monospace;font-size:11px;line-height:1.6;overflow-x:auto;margin:12px 0;">${seg.lines.map(l => inlineHtml(l)).join("\n")}</pre>`)
      continue
    }
    if (seg.type === "table") {
      const [head, ...body] = seg.rows
      result.push(`<table><thead><tr>${head.map(c => `<th>${inlineHtml(c)}</th>`).join("")}</tr></thead><tbody>${body.map(r => `<tr>${r.map(c => `<td>${inlineHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`)
      continue
    }
    let inList = false
    for (const line of seg.lines) {
      const t = line.trim()
      const isList = t.startsWith("- ") || t.startsWith("• ") || /^\d+\.\s/.test(t)
      if (!isList && inList) { result.push("</ul>"); inList = false }
      if (t.startsWith("### "))     { result.push(`<h3>${inlineHtml(t.slice(4))}</h3>`); continue }
      if (t.startsWith("## "))      { result.push(`<h2>${inlineHtml(t.slice(3))}</h2>`); continue }
      if (t.startsWith("# "))       { result.push(`<h1>${inlineHtml(t.slice(2))}</h1>`); continue }
      if (t === "---")              { result.push("<hr />"); continue }
      if (t === "")                 { if (!inList) result.push("<br />"); continue }
      if (t.startsWith("- ") || t.startsWith("• ")) {
        if (!inList) { result.push("<ul>"); inList = true }
        result.push(`<li>${inlineHtml(t.slice(2))}</li>`); continue
      }
      if (/^\d+\.\s/.test(t)) {
        if (!inList) { result.push("<ul>"); inList = true }
        result.push(`<li>${inlineHtml(t.replace(/^\d+\.\s/, ""))}</li>`); continue
      }
      result.push(`<p>${inlineHtml(t)}</p>`)
    }
    if (inList) result.push("</ul>")
  }
  return result.join("\n")
}

function printReport(title: string, period: string, content: string) {
  const html = mdToHtml(content)
  const win  = window.open("", "_blank")
  if (!win) return
  win.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #111827; background: #fff; padding: 48px 52px; max-width: 860px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #7C3AED; padding-bottom: 20px; margin-bottom: 32px; }
    .badge { background: #7C3AED; color: #fff; font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; padding: 3px 10px; border-radius: 999px; }
    .header-title { font-size: 22px; font-weight: 700; margin-top: 8px; color: #111827; }
    .header-meta { font-size: 11px; color: #9CA3AF; margin-top: 4px; }
    h1 { font-size: 20px; font-weight: 700; margin: 28px 0 10px; }
    h2 { font-size: 16px; font-weight: 600; color: #1F2937; margin: 24px 0 10px; padding-bottom: 6px; border-bottom: 1px solid #E5E7EB; }
    h3 { font-size: 13px; font-weight: 600; color: #374151; margin: 16px 0 6px; }
    p { font-size: 13px; line-height: 1.75; color: #374151; margin-bottom: 6px; }
    ul { margin: 8px 0 8px 20px; }
    li { font-size: 13px; line-height: 1.75; color: #374151; margin-bottom: 3px; }
    strong { font-weight: 600; color: #111827; }
    code { background: #F3F4F6; padding: 1px 5px; border-radius: 4px; font-size: 11px; font-family: 'Courier New', monospace; color: #6D28D9; }
    hr { border: none; border-top: 1px solid #E5E7EB; margin: 20px 0; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
    th { background: #F3F4F6; text-align: left; padding: 8px 10px; font-weight: 600; color: #374151; border-bottom: 2px solid #E5E7EB; }
    td { padding: 7px 10px; color: #374151; border-bottom: 1px solid #F3F4F6; }
    tr:last-child td { border-bottom: none; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #E5E7EB; font-size: 11px; color: #9CA3AF; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 0; }
      @page { margin: 1.8cm 1.5cm; size: A4; }
      h2 { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="badge">GTPRO</div>
      <div class="header-title">${title}</div>
      <div class="header-meta">${period} · Gerado em ${new Date().toLocaleString("pt-BR")}</div>
    </div>
  </div>
  ${html}
  <div class="footer">
    <span>GTPRO — Gestão de Meta Ads com IA</span>
    <span>gtpro.vendai.pro</span>
  </div>
  <script>setTimeout(() => { window.print(); }, 600);<\/script>
</body>
</html>`)
  win.document.close()
}

// ─── Markdown renderer (in-page) ──────────────────────────────────────────────

function inlineMd(text: string) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="text-white font-semibold">{p.slice(2,-2)}</strong>
    if (p.startsWith("`")  && p.endsWith("`"))  return <code key={i} className="text-violet-300 bg-violet-500/10 px-1 rounded text-[11px] font-mono">{p.slice(1,-1)}</code>
    return p
  })
}

function RenderMd({ content }: { content: string }) {
  const segs = segmentMd(content)
  const nodes: React.ReactNode[] = []
  let key = 0

  for (const seg of segs) {
    if (seg.type === "code") {
      nodes.push(
        <pre key={key++} className="bg-white/[0.03] rounded-lg border border-white/[0.06] p-4 my-3 font-mono text-[11px] text-zinc-300 whitespace-pre overflow-x-auto leading-relaxed">
          {seg.lines.join("\n")}
        </pre>
      )
      continue
    }
    if (seg.type === "table") {
      const [head, ...body] = seg.rows
      nodes.push(
        <div key={key++} className="overflow-x-auto my-3">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr>
                {head.map((c, ci) => (
                  <th key={ci} className="text-left px-3 py-2 text-zinc-300 font-semibold bg-white/[0.04] border-b border-white/[0.08]">
                    {inlineMd(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                  {row.map((c, ci) => (
                    <td key={ci} className="px-3 py-2 text-zinc-400 align-top">{inlineMd(c)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }
    for (const line of seg.lines) {
      if (line.startsWith("### ")) { nodes.push(<p key={key++} className="text-[13px] font-semibold text-white mt-4 mb-1">{line.slice(4)}</p>); continue }
      if (line.startsWith("## "))  { nodes.push(<p key={key++} className="text-[14px] font-semibold text-zinc-100 mt-5 mb-2 pb-1 border-b border-white/[0.06]">{line.slice(3)}</p>); continue }
      if (line.startsWith("# "))   { nodes.push(<p key={key++} className="text-[16px] font-bold text-white mt-6 mb-2">{line.slice(2)}</p>); continue }
      if (line === "---")          { nodes.push(<hr key={key++} className="border-white/[0.06] my-3" />); continue }
      if (line.startsWith("- ") || line.startsWith("• ")) {
        nodes.push(<div key={key++} className="flex gap-2 items-start"><span className="text-violet-500 mt-[4px] shrink-0 text-[8px]">●</span><span>{inlineMd(line.slice(2))}</span></div>)
        continue
      }
      if (/^\d+\.\s/.test(line)) {
        nodes.push(<div key={key++} className="flex gap-2 items-start"><span className="text-zinc-600 text-[11px] mt-px shrink-0 w-4">{line.match(/^(\d+)/)?.[1]}.</span><span>{inlineMd(line.replace(/^\d+\.\s/, ""))}</span></div>)
        continue
      }
      if (line === "") { nodes.push(<div key={key++} className="h-1.5" />); continue }
      nodes.push(<p key={key++}>{inlineMd(line)}</p>)
    }
  }

  return <div className="text-[12px] text-zinc-400 leading-relaxed space-y-1">{nodes}</div>
}

// ─── Generate modal ───────────────────────────────────────────────────────────

const OBJECTIVES = [
  { id: "all",                label: "Todas as campanhas",   desc: "Analisa todos os objetivos" },
  { id: "OUTCOME_LEADS",      label: "Geração de Leads",     desc: "CPL, leads, taxa clique→lead" },
  { id: "OUTCOME_TRAFFIC",    label: "Tráfego",              desc: "CPC, CTR, cliques outbound" },
  { id: "OUTCOME_ENGAGEMENT", label: "Engajamento",          desc: "CPE, engajamentos, seguidores" },
  { id: "OUTCOME_AWARENESS",  label: "Reconhecimento",       desc: "Alcance, CPM, frequência" },
  { id: "OUTCOME_SALES",      label: "Vendas",               desc: "ROAS, compras, CPP" },
  { id: "OUTCOME_MESSAGES",   label: "WhatsApp",             desc: "Conversas, custo por conversa" },
]

const DATE_PRESETS = [
  { id: "last_7d",     label: "Últimos 7 dias" },
  { id: "last_14d",    label: "Últimos 14 dias" },
  { id: "last_30d",    label: "Últimos 30 dias" },
  { id: "last_90d",    label: "Últimos 90 dias" },
  { id: "this_month",  label: "Este mês" },
  { id: "last_month",  label: "Mês passado" },
  { id: "custom",      label: "Personalizado" },
]

const STEPS = ["Objetivo", "Filtros", "Análises"]

function GenerateModal({ onClose, onGenerate }: {
  onClose: () => void
  onGenerate: (skills: string[], objective: string, datePreset: string, connectionId: string, campaignIds: string[], since?: string, until?: string) => void
}) {
  const [step,         setStep]         = useState<1 | 2 | 3>(1)
  const [objective,    setObjective]    = useState("all")
  const [datePreset,   setDatePreset]   = useState("last_30d")
  const [since,        setSince]        = useState("")
  const [until,        setUntil]        = useState("")
  const [connectionId, setConnectionId] = useState("")
  const [accounts,     setAccounts]     = useState<any[]>([])
  const [campaigns,    setCampaigns]    = useState<any[]>([])
  const [campaignIds,  setCampaignIds]  = useState<string[]>([]) // vazio = todas
  const [loadingData,  setLoadingData]  = useState(false)
  const [selected,     setSelected]     = useState<string[]>(["gargalos"])
  const isCustom    = datePreset === "custom"
  const customReady = isCustom && since && until && since <= until

  // Carrega contas ao abrir passo 2
  useEffect(() => {
    if (step !== 2) return
    setLoadingData(true)
    api.meta.accounts().then((acc: any[]) => {
      setAccounts(acc ?? [])
      const active = acc?.find((a: any) => a.is_active) ?? acc?.[0]
      if (active && !connectionId) setConnectionId(active.id)
    }).catch(() => {}).finally(() => setLoadingData(false))
  }, [step])

  // Carrega campanhas ao mudar conta
  useEffect(() => {
    if (step !== 2 || !connectionId) return
    setCampaigns([])
    setCampaignIds([])
    api.campaigns.list("last_30d").then((cps: any[]) => {
      let active = cps?.filter((c: any) => c.status === "ACTIVE") ?? []
      // Filtra por objetivo selecionado na etapa 1
      if (objective !== "all") {
        active = active.filter((c: any) =>
          (c.objective ?? "").toUpperCase().includes(objective.replace("OUTCOME_", ""))
        )
      }
      setCampaigns(active)
    }).catch(() => {})
  }, [connectionId, step, objective])

  function toggleCampaign(id: string) {
    setCampaignIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id])
  }

  const objLabel  = OBJECTIVES.find(o => o.id === objective)?.label ?? ""
  const dateLabel = isCustom && since && until ? `${since} → ${until}` : (DATE_PRESETS.find(d => d.id === datePreset)?.label ?? "")
  const accLabel  = accounts.find(a => a.id === connectionId)?.ad_account_id ?? ""

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111113] ring-1 ring-white/[0.10] rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07] shrink-0">
          <div className="flex items-center gap-2.5">
            <Sparkles size={14} className="text-violet-400" />
            <h2 className="text-[15px] font-semibold text-white">Gerar Relatório</h2>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X size={16} /></button>
        </div>

        {/* Progress */}
        <div className="flex items-center px-6 pt-4 pb-2 gap-1 shrink-0">
          {STEPS.map((label, i) => {
            const n = i + 1
            return (
              <React.Fragment key={n}>
                <div className="flex items-center gap-1.5">
                  <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors",
                    step === n ? "bg-violet-600 text-white" : step > n ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.06] text-zinc-600"
                  )}>
                    {step > n ? <Check size={9} /> : n}
                  </div>
                  <span className={cn("text-[11px] font-medium transition-colors whitespace-nowrap",
                    step === n ? "text-zinc-200" : "text-zinc-600"
                  )}>{label}</span>
                </div>
                {n < STEPS.length && <ChevronRight size={11} className="text-zinc-700 mx-1 shrink-0" />}
              </React.Fragment>
            )
          })}
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">

          {/* Step 1: Objetivo */}
          {step === 1 && (
            <>
              <p className="text-[12px] text-zinc-500">Qual é o objetivo das campanhas a analisar?</p>
              <div className="grid grid-cols-2 gap-1.5">
                {OBJECTIVES.map(obj => (
                  <button key={obj.id} type="button" onClick={() => setObjective(obj.id)}
                    className={cn("flex flex-col items-start px-3 py-2.5 rounded-xl ring-1 text-left transition-all",
                      objective === obj.id ? "bg-violet-600/15 ring-violet-500/40" : "bg-white/[0.02] ring-white/[0.06] hover:bg-white/[0.05]"
                    )}>
                    <p className={cn("text-[12px] font-medium leading-tight", objective === obj.id ? "text-violet-300" : "text-zinc-300")}>{obj.label}</p>
                    <p className="text-[10px] text-zinc-600 mt-0.5">{obj.desc}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2: Filtros */}
          {step === 2 && (
            <>
              {/* Período */}
              <div>
                <p className="text-[12px] text-zinc-500 mb-2">Período</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {DATE_PRESETS.map(d => (
                    <button key={d.id} type="button" onClick={() => setDatePreset(d.id)}
                      className={cn("px-3 py-2 rounded-lg ring-1 text-left transition-all",
                        datePreset === d.id ? "bg-violet-600/15 ring-violet-500/40" : "bg-white/[0.02] ring-white/[0.06] hover:bg-white/[0.05]"
                      )}>
                      <p className={cn("text-[11px] font-medium", datePreset === d.id ? "text-violet-300" : "text-zinc-400")}>{d.label}</p>
                    </button>
                  ))}
                </div>
                {isCustom && (
                  <div className="mt-2 flex items-center gap-2">
                    <input type="date" value={since} onChange={e => setSince(e.target.value)}
                      className="flex-1 bg-white/[0.04] ring-1 ring-white/[0.07] rounded-lg px-3 py-1.5 text-[11px] text-white focus:outline-none focus:ring-violet-500/50 [color-scheme:dark]" />
                    <span className="text-zinc-600 text-[11px] shrink-0">até</span>
                    <input type="date" value={until} onChange={e => setUntil(e.target.value)} min={since}
                      className="flex-1 bg-white/[0.04] ring-1 ring-white/[0.07] rounded-lg px-3 py-1.5 text-[11px] text-white focus:outline-none focus:ring-violet-500/50 [color-scheme:dark]" />
                  </div>
                )}
              </div>

              {/* Conta de anúncio */}
              {loadingData ? (
                <div className="flex items-center gap-2 text-zinc-600 text-[12px]"><Loader2 size={12} className="animate-spin" /> Carregando contas...</div>
              ) : accounts.length > 1 && (
                <div>
                  <p className="text-[12px] text-zinc-500 mb-2">Conta de anúncio</p>
                  <div className="space-y-1.5">
                    {accounts.map(acc => (
                      <button key={acc.id} type="button" onClick={() => setConnectionId(acc.id)}
                        className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ring-1 text-left transition-all",
                          connectionId === acc.id ? "bg-violet-600/15 ring-violet-500/40" : "bg-white/[0.02] ring-white/[0.06] hover:bg-white/[0.05]"
                        )}>
                        <div className={cn("w-2 h-2 rounded-full shrink-0", acc.is_active ? "bg-emerald-400" : "bg-zinc-600")} />
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-[12px] font-medium truncate", connectionId === acc.id ? "text-violet-300" : "text-zinc-300")}>
                            {acc.name || `Conta ${acc.ad_account_id}`}
                          </p>
                          <p className="text-[10px] text-zinc-600">act_{acc.ad_account_id}</p>
                        </div>
                        {connectionId === acc.id && <Check size={12} className="text-violet-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Campanhas */}
              {campaigns.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[12px] text-zinc-500">Campanhas ativas</p>
                    <button type="button" onClick={() => setCampaignIds([])}
                      className="text-[10px] text-zinc-600 hover:text-violet-400 transition-colors">
                      {campaignIds.length === 0 ? "Todas selecionadas" : `${campaignIds.length} selecionada(s)`}
                    </button>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                    {campaigns.map((c: any) => {
                      const on = campaignIds.length === 0 || campaignIds.includes(c.id)
                      return (
                        <button key={c.id} type="button" onClick={() => toggleCampaign(c.id)}
                          className={cn("w-full flex items-center gap-2.5 px-3 py-2 rounded-lg ring-1 text-left transition-all",
                            on ? "bg-white/[0.03] ring-white/[0.08]" : "bg-transparent ring-transparent opacity-40"
                          )}>
                          <div className={cn("w-3.5 h-3.5 rounded border shrink-0 flex items-center justify-center transition-colors",
                            on ? "bg-violet-500 border-violet-500" : "border-zinc-600"
                          )}>
                            {on && <Check size={9} className="text-white" />}
                          </div>
                          <p className="text-[11px] text-zinc-300 truncate flex-1">{c.name}</p>
                          <p className="text-[10px] text-zinc-600 shrink-0">R${Number(c.metrics?.spend ?? 0).toFixed(0)}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Step 3: Análises */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400">{objLabel}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400">{dateLabel}</span>
                {accLabel && <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400">act_{accLabel}</span>}
                {campaignIds.length > 0 && <span className="text-[10px] px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400">{campaignIds.length} campanhas</span>}
              </div>
              <p className="text-[12px] text-zinc-500">Quais análises incluir?</p>
              <div className="space-y-2">
                {SKILLS.map(skill => {
                  const Icon = skill.icon
                  const on   = selected.includes(skill.id)
                  return (
                    <button key={skill.id} type="button" onClick={() => toggle(skill.id)}
                      className={cn("w-full flex items-center gap-3 px-4 py-3 rounded-xl ring-1 text-left transition-all",
                        on ? "bg-violet-600/10 ring-violet-500/30" : "bg-white/[0.02] ring-white/[0.06] hover:bg-white/[0.05]"
                      )}>
                      <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ring-1", skill.color)}>
                        <Icon size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[13px] font-medium", on ? "text-white" : "text-zinc-300")}>{skill.label}</p>
                        <p className="text-[11px] text-zinc-600 mt-0.5">{skill.desc}</p>
                      </div>
                      <div className={cn("w-4 h-4 rounded-full border-2 shrink-0 transition-all",
                        on ? "bg-violet-500 border-violet-500" : "border-zinc-600"
                      )}>
                        {on && <Check size={10} className="text-white m-auto translate-y-[1px]" />}
                      </div>
                    </button>
                  )
                })}
              </div>
              <p className="text-[11px] text-zinc-600">
                Apenas campanhas <span className="text-emerald-400 font-medium">ativas</span> serão analisadas.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-white/[0.06] shrink-0">
          <button type="button" onClick={step === 1 ? onClose : () => setStep((step - 1) as any)}
            className="flex-1 py-2 text-[13px] text-zinc-400 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-xl hover:bg-white/[0.07] transition-colors">
            {step === 1 ? "Cancelar" : "← Voltar"}
          </button>
          {step < 3 ? (
            <button type="button" onClick={() => setStep((step + 1) as any)}
              className="flex-1 py-2 text-[13px] text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-colors font-medium">
              Próximo →
            </button>
          ) : (
            <button type="button"
              onClick={() => onGenerate(selected, objective, datePreset, connectionId, campaignIds, isCustom ? since : undefined, isCustom ? until : undefined)}
              disabled={selected.length === 0 || (isCustom && !customReady)}
              className="flex-1 py-2 text-[13px] text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-colors disabled:opacity-40 font-medium flex items-center justify-center gap-2">
              <Sparkles size={13} /> Gerar relatório
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const [reports, setReports]             = useState<Report[]>([])
  const [loading, setLoading]             = useState(true)
  const [generating, setGenerating]       = useState(false)
  const [expanded, setExpanded]           = useState<string | null>(null)
  const [schedule, setSchedule]           = useState("none")
  const [scheduleWhatsapp, setScheduleWhatsapp] = useState(false)
  const [savingSchedule, setSavingSchedule]     = useState(false)
  const [savedSchedule, setSavedSchedule]       = useState(false)
  const [showModal, setShowModal]         = useState(false)

  useEffect(() => {
    api.reports.list().then((d: any) => {
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

  async function generateReport(skills: string[], objective: string, datePreset: string, connectionId: string, campaignIds: string[], since?: string, until?: string) {
    setShowModal(false)
    setGenerating(true)
    try {
      const report = await api.reports.generate(skills, objective, datePreset, connectionId || undefined, campaignIds, since, until)
      setReports(p => [report, ...p])
      setExpanded(report.id)
    } catch (e: any) {
      alert(e.message || "Erro ao gerar relatório")
    } finally { setGenerating(false) }
  }

  return (
    <div className="space-y-7">
      {showModal && <GenerateModal onClose={() => setShowModal(false)} onGenerate={generateReport} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-white">Relatórios</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5">Gerados automaticamente pelo agente</p>
        </div>
        <button onClick={() => setShowModal(true)} disabled={generating}
          className="flex items-center gap-2 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-colors">
          {generating ? <><Loader2 size={13} className="animate-spin" /> Gerando...</> : <><Plus size={13} /> Gerar relatório</>}
        </button>
      </div>

      {/* Schedule */}
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
          O agente está analisando suas campanhas ativas...
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
          {reports.map(report => (
            <div key={report.id} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-3.5">
                <div className="w-7 h-7 rounded-lg bg-violet-600/15 flex items-center justify-center shrink-0">
                  <FileText size={13} className="text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-zinc-200">{report.title}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{report.period}</p>
                </div>
                <p className="text-[11px] text-zinc-700 shrink-0" suppressHydrationWarning>
                  {new Date(report.created_at).toLocaleDateString("pt-BR")}
                </p>
                {report.summary && (
                  <button onClick={() => printReport(report.title, report.period, report.summary!)}
                    title="Exportar PDF"
                    className="w-7 h-7 flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-colors">
                    <Download size={13} className="text-zinc-600 hover:text-violet-400" />
                  </button>
                )}
                {report.summary && (
                  <button onClick={() => setExpanded(expanded === report.id ? null : report.id)}
                    className="w-7 h-7 flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-colors">
                    {expanded === report.id
                      ? <ChevronUp size={13} className="text-zinc-600" />
                      : <ChevronDown size={13} className="text-zinc-600" />}
                  </button>
                )}
              </div>
              {expanded === report.id && report.summary && (
                <div className="px-5 pb-6 border-t border-white/[0.05] pt-5">
                  <RenderMd content={report.summary} />
                  <button onClick={() => printReport(report.title, report.period, report.summary!)}
                    className="mt-5 flex items-center gap-1.5 px-3.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.07] ring-1 ring-white/[0.08] text-zinc-400 hover:text-white text-[12px] rounded-lg transition-colors">
                    <Download size={11} /> Exportar como PDF
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
