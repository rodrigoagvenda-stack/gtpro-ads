"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { api } from "@/lib/api"
import {
  ArrowUp, Bot, Search, BarChart2, Zap, Bell, Power, DollarSign,
  CheckCircle2, Sparkles, ChevronDown, ChevronRight, Trash2, FileText,
  Users, Image, X, ListChecks, XCircle, RefreshCw, Paperclip, Upload,
  Film, Check, ThumbsDown, MessageSquare, Square, PauseCircle, TrendingUp,
  Plus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import WizardPanel from "./WizardPanel"

function CampaignBriefCard({ b }: { b: CampaignBrief }) {
  const name     = b.name ?? b.objectiveLabel ?? "Nova Campanha"
  const adsets   = b.adsets ?? 1
  const ads      = b.ads ?? 1
  const budget   = b.dailyBudget ? `R$${b.dailyBudget}${b.lifetimeBudget ? " total" : "/dia"} · ${b.budgetType ?? "ABO"}` : null
  const hasMedia = b.creativeHash || b.creativeVideoId
  return (
    <div className="bg-zinc-800/80 ring-1 ring-white/[0.09] rounded-2xl rounded-tr-sm px-5 py-4 min-w-[240px]">
      <div className="flex items-center gap-2 mb-3 pb-2.5 border-b border-white/[0.06]">
        <Sparkles size={12} className="text-violet-400 shrink-0" />
        <span className="text-[12px] font-semibold text-white">Nova Campanha</span>
        {b.objectiveLabel && <span className="text-[11px] text-zinc-500">· {b.objectiveLabel}</span>}
      </div>
      <div className="font-mono text-[12px] space-y-1 mb-3">
        <p className="text-zinc-200">📁 {name}</p>
        {Array.from({ length: Math.min(adsets, 3) }).map((_, i) => (
          <div key={i}>
            <p className="pl-4 text-zinc-400">└─ 📂 Conjunto {i + 1}</p>
            {Array.from({ length: Math.min(ads, 2) }).map((_, j) => (
              <p key={j} className="pl-9 text-zinc-600">└─ 🖼 Anúncio {j + 1}</p>
            ))}
          </div>
        ))}
        {adsets > 3 && <p className="pl-4 text-zinc-700 text-[11px]">+{adsets - 3} conjuntos…</p>}
      </div>
      <div className="space-y-1">
        {b.geo && b.geo.length > 0 && <p className="text-[11px] text-zinc-500">📍 {b.geo.map(g => `${g.name} ${g.radius}km`).join(" · ")}</p>}
        {budget && <p className="text-[11px] text-zinc-500">💰 {budget}</p>}
        {hasMedia && <p className="text-[11px] text-emerald-400">🖼 Mídia: {b.creativeName ?? "upload"} ✓</p>}
      </div>
    </div>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToolCall { name: string; input: Record<string, any> }
interface Action   { tool: string; input: Record<string, any>; result: any }
interface CampaignBrief {
  objectiveLabel?: string; name?: string; campaigns?: number; adsets?: number; ads?: number
  budgetType?: string; dailyBudget?: number; lifetimeBudget?: boolean
  geo?: { name: string; radius: number; region?: string }[]
  creativeHash?: string; creativeVideoId?: string; creativeName?: string
}
interface Message  {
  role: "user" | "assistant"
  content: string
  tools_used?: ToolCall[]
  actions?: Action[]
  mediaUpload?: { name: string; type: string; hash?: string; videoId?: string }
  campaignBrief?: CampaignBrief
  isError?: boolean
}
interface ActiveTool { name: string; status: "running" | "done" | "error" }
interface LogEntry {
  id: string; action: string
  params: Record<string, any> | null
  result: Record<string, any> | null
  status: string; created_at: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIRM_RE = /posso implementar|posso executar|confirma (a |o |essa |essa estrutura)|quer que eu (execute|crie|faça|implemente|ative|prossiga)|devo prosseguir|posso prosseguir|posso criar isso/i
const CHOICE_RE  = /\?|deseja|quer\s|escolh|opç[aã]|prefere|selecione|confirma|como\s+posso|o\s+que\s+gostaria/i

const TOOL_LABELS: Record<string, string> = {
  get_campaigns: "Buscando campanhas", get_account_insights: "Carregando insights", get_campaign_insights: "Analisando campanha",
  get_insights_breakdown: "Processando breakdown", get_adsets: "Carregando conjuntos", get_ads: "Carregando anúncios",
  create_campaign: "Criando campanha", update_campaign: "Atualizando campanha",
  duplicate_campaign: "Duplicando campanha", delete_campaign: "Deletando campanha", toggle_campaign: "Alterando status",
  create_adset: "Criando conjunto", update_adset: "Atualizando conjunto",
  create_ad: "Criando anúncio", update_ad: "Atualizando anúncio",
  get_pixels: "Verificando pixels", get_audiences: "Carregando públicos",
  create_lookalike_audience: "Criando lookalike", create_website_audience: "Criando público website",
  get_account_info: "Carregando conta", check_whatsapp_status: "Verificando WhatsApp", generate_utm: "Gerando UTM",
}

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5",  desc: "Rápido" },
  { id: "claude-sonnet-4-6",         label: "Sonnet 4.6", desc: "Equilibrado" },
  { id: "claude-opus-4-7",           label: "Opus 4.7",   desc: "Mais capaz" },
]

const SUGGESTIONS = [
  { icon: BarChart2, text: "Analise a performance dos últimos 7 dias" },
  { icon: Search,    text: "Quais campanhas estão com ROAS abaixo do mínimo?" },
  { icon: DollarSign, text: "Alguma campanha com CPL muito alto?" },
  { icon: Zap,       text: "Crie uma nova campanha de captação" },
]

type ActiveAction = "analise" | "pausar" | "otimizar" | null

const MAIN_ACTIONS = [
  { id: "analise",  label: "Análise",         icon: BarChart2,    color: "text-blue-400 bg-blue-500/10 ring-blue-500/25 hover:bg-blue-500/15" },
  { id: "criar",    label: "Criar campanha",  icon: Plus,          color: "text-violet-400 bg-violet-500/10 ring-violet-500/25 hover:bg-violet-500/15" },
  { id: "pausar",   label: "Pausar",          icon: PauseCircle,   color: "text-amber-400 bg-amber-500/10 ring-amber-500/25 hover:bg-amber-500/15" },
  { id: "otimizar", label: "Otimizar",        icon: TrendingUp,    color: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/25 hover:bg-emerald-500/15" },
] as const

const SUB_ACTIONS: Record<Exclude<ActiveAction, null>, { label: string; prompt: string }[]> = {
  analise: [
    { label: "Conta completa",  prompt: "Faça uma análise completa da conta dos últimos 7 dias com métricas de performance e recomendações de otimização." },
    { label: "Por campanha",    prompt: "Analise o desempenho individual de cada campanha ativa nos últimos 7 dias e identifique as melhores e piores." },
    { label: "Criativo",        prompt: "Analise CTR e frequência dos criativos. Identifique os que estão saturados e sugira pausar." },
    { label: "Público",         prompt: "Faça um breakdown do desempenho por idade, sexo e região das campanhas ativas." },
    { label: "Conjuntos",       prompt: "Compare o desempenho dos conjuntos de anúncios. Identifique os melhores para escalar." },
    { label: "Placement",       prompt: "Analise custo por resultado por placement: Facebook Feed vs Reels vs Stories vs Messenger." },
  ],
  pausar: [
    { label: "Pausar todas",          prompt: "Liste todas as campanhas ativas e me mostre um resumo. Quais devo pausar?" },
    { label: "ROAS abaixo do mínimo", prompt: "Identifique campanhas com ROAS abaixo do aceitável e recomende quais pausar com justificativa." },
    { label: "CPL muito alto",        prompt: "Identifique campanhas com CPL acima do benchmark e recomende pausar as piores." },
    { label: "Frequência alta",       prompt: "Identifique conjuntos com frequência acima de 3 que estão saturados e sugira pausar." },
  ],
  otimizar: [
    { label: "Aumentar budget",    prompt: "Analise quais campanhas estão com bom ROAS e recomende aumento de budget com valores sugeridos." },
    { label: "Pausar ruins",       prompt: "Identifique os anúncios e conjuntos com pior performance e recomende pausar com dados." },
    { label: "Duplicar vencedora", prompt: "Identifique a campanha com melhor ROAS e sugira como duplicar com novo público." },
    { label: "Ajustar público",    prompt: "Analise o breakdown por idade/sexo/região e sugira como otimizar o targeting dos conjuntos." },
  ],
}

const SKILL_ICONS: Record<string, any> = {
  BarChart2, Zap, Search, FileText, Users, Image, Bell, DollarSign, Power,
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function inlineMd(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i} className="text-white font-semibold">{p.slice(2,-2)}</strong>
    if (p.startsWith("`") && p.endsWith("`"))
      return <code key={i} className="text-violet-300 bg-violet-500/[0.12] px-1.5 py-0.5 rounded-md text-[12px] font-mono">{p.slice(1,-1)}</code>
    return p
  })
}

function renderMd(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return <p key={i} className="text-[15px] font-semibold text-white mt-6 mb-2">{line.slice(4)}</p>
    if (line.startsWith("## "))  return <p key={i} className="text-[16px] font-semibold text-white mt-6 mb-2">{line.slice(3)}</p>
    if (line.startsWith("# "))   return <p key={i} className="text-[18px] font-bold text-white mt-6 mb-3">{line.slice(2)}</p>
    if (line.startsWith("---"))  return <hr key={i} className="border-white/[0.07] my-4" />
    if (line.startsWith("- ") || line.startsWith("• ")) return (
      <div key={i} className="flex gap-3 items-start my-1">
        <span className="mt-[9px] shrink-0 w-1 h-1 rounded-full bg-zinc-500 inline-block" />
        <span className="leading-relaxed">{inlineMd(line.slice(2))}</span>
      </div>
    )
    if (/^\d+\.\s/.test(line)) return (
      <div key={i} className="flex gap-3 items-start my-1">
        <span className="text-zinc-500 text-[12px] mt-0.5 shrink-0 tabular-nums w-4 text-right">{line.match(/^(\d+)/)?.[1]}.</span>
        <span className="leading-relaxed">{inlineMd(line.replace(/^\d+\.\s/, ""))}</span>
      </div>
    )
    if (line.startsWith("|")) return <p key={i} className="my-0.5 text-zinc-400 font-mono text-[12px]">{line}</p>
    if (line === "") return <div key={i} className="h-3" />
    return <p key={i} className="my-0.5 leading-[1.75]">{inlineMd(line)}</p>
  })
}

// ─── Quick reply extraction ───────────────────────────────────────────────────

function extractQuickReplies(content: string): { label: string; value: string }[] | null {
  const lines = content.split("\n").map(l => l.trim()).filter(Boolean)
  const hasQ  = CHOICE_RE.test(content)
  const numbered = lines.filter(l => /^\d+\.\s.+/.test(l))
  if (numbered.length >= 2 && numbered.length <= 6 && hasQ)
    return numbered.map((l, i) => ({ label: l.replace(/^\d+\.\s/, "").trim(), value: String(i + 1) }))
  const bullets = lines.filter(l => /^[-•*]\s.+/.test(l))
  if (bullets.length >= 2 && bullets.length <= 6 && hasQ)
    return bullets.map((l, i) => ({ label: l.replace(/^[-•*]\s/, "").trim(), value: String(i + 1) }))
  return null
}

// ─── Step detection ───────────────────────────────────────────────────────────

const CREATION_STEPS = ["Objetivo","Público","Budget","Criativo","Copy","UTM","Nome","Revisão"]
function detectCurrentStep(messages: Message[]): number {
  const last = [...messages].reverse().find(m => m.role === "assistant")?.content ?? ""
  for (let i = CREATION_STEPS.length - 1; i >= 0; i--) {
    if (last.toLowerCase().includes(CREATION_STEPS[i].toLowerCase())) return i
  }
  return -1
}
function isInCreationFlow(messages: Message[]): boolean {
  const recent = messages.slice(-6).map(m => m.content.toLowerCase()).join(" ")
  return recent.includes("modo manual") || recent.includes("passo a passo") ||
    recent.includes("objetivo da campanha") || recent.includes("público-alvo") ||
    recent.includes("formato do criativo") || recent.includes("copy do anúncio")
}

// ─── Log panel ────────────────────────────────────────────────────────────────

function LogsPanel({ logs, loading, onRefresh }: { logs: LogEntry[]; loading: boolean; onRefresh: () => void }) {
  return (
    <div className="mb-4 bg-zinc-900 ring-1 ring-white/[0.07] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.05]">
        <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Últimas 30 ações</span>
        <button onClick={onRefresh} disabled={loading} className="text-zinc-600 hover:text-zinc-300 transition-colors disabled:opacity-40">
          <RefreshCw size={11} className={cn(loading && "animate-spin")} />
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto divide-y divide-white/[0.04]">
        {loading && <div className="px-5 py-4 text-[12px] text-zinc-600">Carregando...</div>}
        {!loading && logs.length === 0 && <div className="px-5 py-4 text-[12px] text-zinc-600">Nenhuma ação registrada.</div>}
        {logs.map(log => (
          <div key={log.id} className="flex items-center gap-3 px-5 py-2.5">
            {log.status === "success"
              ? <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
              : <XCircle size={11} className="text-red-400 shrink-0" />}
            <span className="flex-1 text-[12px] text-zinc-300 truncate">{log.action}</span>
            {log.status !== "success" && log.result?.error && (
              <span className="text-[11px] text-red-400/70 truncate max-w-[160px]">{log.result.error}</span>
            )}
            <span className="text-[11px] text-zinc-700 shrink-0 tabular-nums">
              {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentePage() {
  const [messages, setMessages]             = useState<Message[]>([])
  const [input, setInput]                   = useState("")
  const [loading, setLoading]               = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [activeTools, setActiveTools]       = useState<ActiveTool[]>([])
  const [isStreaming, setIsStreaming]        = useState(false)
  const [model, setModel]                   = useState("claude-sonnet-4-6")
  const [modelOpen, setModelOpen]           = useState(false)
  const [skills, setSkills]                 = useState<any[]>([])
  const [skillsOpen, setSkillsOpen]         = useState(false)
  const [logs, setLogs]                     = useState<LogEntry[]>([])
  const [logsOpen, setLogsOpen]             = useState(false)
  const [logsLoading, setLogsLoading]       = useState(false)
  const [uploading, setUploading]           = useState(false)
  const [wizardOpen, setWizardOpen]         = useState(false)
  const [activeAction, setActiveAction]     = useState<ActiveAction>(null)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const skillsRef   = useRef<HTMLDivElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)
  const abortRef    = useRef<AbortController | null>(null)

  useEffect(() => {
    api.skills.list().then((d: any[]) => setSkills(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (skillsRef.current && !skillsRef.current.contains(e.target as Node)) setSkillsOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  function loadMessages() {
    setLoadingHistory(true)
    api.agent.messages().then((rows: any[]) => {
      setMessages(rows.map(r => ({ role: r.role, content: r.content, tools_used: r.tools_used ?? undefined, actions: r.actions ?? undefined })))
    }).catch(() => {}).finally(() => setLoadingHistory(false))
  }

  useEffect(() => { loadMessages() }, [])

  useEffect(() => {
    function handleSwitch() { setMessages([]); loadMessages() }
    window.addEventListener("account-switched", handleSwitch)
    return () => window.removeEventListener("account-switched", handleSwitch)
  }, [])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, loading, activeTools])

  async function clearHistory() {
    if (!confirm("Apagar todo o histórico?")) return
    await api.agent.clearMessages()
    setMessages([])
  }

  async function loadLogs() {
    setLogsLoading(true)
    try { const data = await api.agent.logs(30); setLogs(Array.isArray(data) ? data : []) }
    catch {} finally { setLogsLoading(false) }
  }

  function stopStreaming() {
    abortRef.current?.abort()
    setLoading(false); setIsStreaming(false); setActiveTools([])
  }

  const send = useCallback(async (text: string, extraMsgProps?: Partial<Message>) => {
    if (!text.trim() || loading) return
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    const userMsg: Message = { role: "user", content: text, ...extraMsgProps }
    setMessages(p => [...p, userMsg, { role: "assistant", content: "", tools_used: [], actions: [] }])
    setLoading(true); setIsStreaming(false); setActiveTools([])

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      await api.agent.queryStream(text, model, history, (chunk: any) => {
        if (chunk.type === "text") {
          setIsStreaming(true)
          setMessages(p => {
            const msgs = [...p]
            const last = msgs[msgs.length - 1]
            if (last?.role === "assistant") msgs[msgs.length - 1] = { ...last, content: last.content + chunk.delta }
            return msgs
          })
        } else if (chunk.type === "tool_start") {
          setActiveTools(p => [...p.filter(t => t.name !== chunk.name), { name: chunk.name, status: "running" }])
        } else if (chunk.type === "tool_done") {
          setActiveTools(p => p.map(t => t.name === chunk.name ? { ...t, status: "done" } : t))
          setMessages(p => {
            const msgs = [...p]
            const last = msgs[msgs.length - 1]
            if (last?.role === "assistant") {
              const existing = last.tools_used ?? []
              if (!existing.some(t => t.name === chunk.name))
                msgs[msgs.length - 1] = { ...last, tools_used: [...existing, { name: chunk.name, input: {} }] }
            }
            return msgs
          })
        } else if (chunk.type === "tool_error") {
          setActiveTools(p => p.map(t => t.name === chunk.name ? { ...t, status: "error" } : t))
        } else if (chunk.type === "action") {
          setMessages(p => {
            const msgs = [...p]
            const last = msgs[msgs.length - 1]
            if (last?.role === "assistant")
              msgs[msgs.length - 1] = { ...last, actions: [...(last.actions ?? []), chunk] }
            return msgs
          })
        } else if (chunk.type === "error") {
          setMessages(p => {
            const msgs = [...p]
            const last = msgs[msgs.length - 1]
            if (last?.role === "assistant")
              msgs[msgs.length - 1] = { ...last, content: chunk.message, isError: true }
            return msgs
          })
        }
      }, ctrl.signal)
    } catch (e: any) {
      if (e?.name === "AbortError") return
      const msg = e?.message ?? ""
      const isTimeout = msg.includes("timeout") || msg.includes("abort")
      setMessages(p => {
        const msgs = [...p]
        const last = msgs[msgs.length - 1]
        if (last?.role === "assistant" && !last.content)
          msgs[msgs.length - 1] = {
            ...last,
            content: isTimeout
              ? "A resposta demorou mais do esperado. Se você confirmou uma ação, verifique nas campanhas se foi executada."
              : `Erro ao processar. ${msg || "Verifique se o agente está configurado."}`,
            isError: true
          }
        return msgs
      })
    } finally {
      setLoading(false); setIsStreaming(false); setActiveTools([])
    }
  }, [loading, messages, model])

  async function handleFileUpload(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("name", file.name)
      const { createClient } = await import("@/lib/supabase")
      const token = (await createClient().auth.getSession()).data.session?.access_token
      const res = await fetch("/api/meta/media", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const isVideo = file.type.startsWith("video/")
      const info    = isVideo
        ? `Mídia enviada: "${file.name}" (vídeo, ID: ${data.meta_video_id})`
        : `Mídia enviada: "${file.name}" (imagem, hash: ${data.meta_hash})`
      setMessages(p => [...p, {
        role: "user", content: info,
        mediaUpload: { name: file.name, type: isVideo ? "video" : "image", hash: data.meta_hash, videoId: data.meta_video_id },
      }])
      await send(`Fiz o upload da mídia "${file.name}". ${isVideo ? `O video_id é ${data.meta_video_id}` : `O image_hash é ${data.meta_hash}`}. Pode usar no criativo.`)
    } catch (e: any) { alert(`Erro no upload: ${e.message}`) }
    finally { setUploading(false) }
  }

  if (loadingHistory) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex gap-1">
          {[0, 120, 240].map(d => (
            <span key={d} className="w-2 h-2 rounded-full bg-violet-500/40 animate-bounce"
              style={{ animationDelay: `${d}ms`, animationDuration: "1.2s" }} />
          ))}
        </div>
      </div>
    )
  }

  const lastAssistant = [...messages].reverse().find(m => m.role === "assistant")
  const isConfirm     = !loading && lastAssistant && !lastAssistant.isError && CONFIRM_RE.test(lastAssistant.content)
  const quickReplies  = !loading && !isConfirm && lastAssistant && !lastAssistant.isError
    ? extractQuickReplies(lastAssistant.content) : null
  const inFlow        = isInCreationFlow(messages)
  const currentStep   = inFlow ? detectCurrentStep(messages) : -1

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between py-3 shrink-0">
        <button
          onClick={() => { if (!logsOpen) loadLogs(); setLogsOpen(v => !v) }}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all",
            logsOpen
              ? "text-violet-300 bg-violet-500/10 ring-1 ring-violet-500/25"
              : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]"
          )}>
          <ListChecks size={13} />
          Logs
          <ChevronDown size={10} className={cn("transition-transform", logsOpen && "rotate-180")} />
        </button>

        <div className="flex items-center gap-1.5">
          {loading && (
            <button onClick={stopStreaming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] text-zinc-500 hover:text-red-400 hover:bg-red-500/[0.08] ring-1 ring-white/[0.07] transition-all">
              <Square size={10} fill="currentColor" /> Parar
            </button>
          )}
          {messages.length > 0 && !loading && (
            <button onClick={clearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] text-zinc-600 hover:text-red-400 hover:bg-red-500/[0.08] transition-all">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Logs panel */}
      {logsOpen && (
        <LogsPanel logs={logs} loading={logsLoading} onRefresh={loadLogs} />
      )}

      {/* Step progress */}
      {inFlow && currentStep >= 0 && (
        <div className="shrink-0 mb-3">
          <div className="flex items-center gap-1">
            {CREATION_STEPS.map((label, i) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <div className={cn("h-[3px] w-full rounded-full transition-all duration-500",
                  i < currentStep  ? "bg-violet-500" :
                  i === currentStep ? "bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.6)]" : "bg-white/[0.06]"
                )} />
                {i === currentStep && <span className="text-[9px] text-violet-400 font-medium">{label}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scroll area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-[700px] mx-auto w-full py-8 px-2">

          {/* Empty state */}
          {messages.length === 0 && !loading && !wizardOpen && (
            <div className="flex flex-col items-center gap-10 pt-8 pb-4">
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600/25 to-violet-900/10 ring-1 ring-violet-500/20 flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.12)]">
                  <Sparkles size={28} className="text-violet-400" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-[26px] font-bold text-white tracking-tight">Como posso ajudar?</h2>
                  <p className="text-[14px] text-zinc-500 max-w-xs leading-relaxed">
                    Analiso, otimizo e executo no Meta Ads — campanhas, públicos, criativos e relatórios.
                  </p>
                </div>
              </div>

              {/* Primary action buttons */}
              <div className="w-full max-w-xl space-y-3">
                <div className="flex flex-wrap gap-2 justify-center">
                  {MAIN_ACTIONS.map(action => {
                    const Icon    = action.icon
                    const isActive = action.id !== "criar" && activeAction === action.id
                    return (
                      <button key={action.id}
                        onClick={() => {
                          if (action.id === "criar") { setWizardOpen(true); setActiveAction(null) }
                          else setActiveAction(isActive ? null : action.id as ActiveAction)
                        }}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[13px] font-semibold ring-1 transition-all",
                          isActive
                            ? "bg-white/[0.1] text-white ring-white/[0.2]"
                            : action.color
                        )}>
                        <Icon size={14} />
                        {action.label}
                      </button>
                    )
                  })}
                </div>

                {/* Sub-chips */}
                {activeAction && activeAction in SUB_ACTIONS && (
                  <div className="flex flex-wrap gap-2 justify-center animate-in fade-in slide-in-from-top-1 duration-200">
                    {SUB_ACTIONS[activeAction].map(sub => (
                      <button key={sub.label}
                        onClick={() => { send(sub.prompt); setActiveAction(null) }}
                        className="px-3.5 py-2 rounded-xl text-[12px] font-medium bg-white/[0.04] text-zinc-300 ring-1 ring-white/[0.08] hover:bg-white/[0.09] hover:text-white transition-all">
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Skills / suggestions */}
              {!activeAction && (
                skills.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-xl">
                    {skills.map(skill => {
                      const Icon = SKILL_ICONS[skill.icon] ?? Zap
                      return (
                        <button key={skill.id} onClick={() => send(skill.prompt)}
                          className="text-left px-5 py-4 bg-white/[0.03] ring-1 ring-white/[0.07] rounded-2xl hover:bg-white/[0.06] hover:ring-white/[0.12] transition-all group">
                          <div className="flex items-center gap-2.5 mb-1.5">
                            <Icon size={14} className="text-violet-400" />
                            <span className="text-[13px] font-semibold text-zinc-200 group-hover:text-white">{skill.name}</span>
                          </div>
                          <p className="text-[12px] text-zinc-600 leading-snug line-clamp-2">{skill.prompt.slice(0, 80)}…</p>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 w-full max-w-xl">
                    {SUGGESTIONS.map(s => (
                      <button key={s.text} onClick={() => send(s.text)}
                        className="flex items-start gap-3 text-left px-5 py-4 bg-white/[0.03] ring-1 ring-white/[0.07] rounded-2xl hover:bg-white/[0.06] hover:ring-white/[0.12] transition-all group">
                        <s.icon size={14} className="text-zinc-500 mt-0.5 shrink-0 group-hover:text-zinc-300 transition-colors" />
                        <span className="text-[13px] text-zinc-400 group-hover:text-zinc-200 leading-snug transition-colors">{s.text}</span>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          )}

          {/* Wizard — fills chat area when open */}
          {wizardOpen && (
            <div className="py-4">
              <WizardPanel
                onSubmit={(msg, draft) => {
                  setWizardOpen(false)
                  const brief: CampaignBrief = {
                    objectiveLabel: draft.objectiveLabel, name: draft.name,
                    campaigns: draft.campaigns, adsets: draft.adsets, ads: draft.ads,
                    budgetType: draft.budgetType, dailyBudget: draft.dailyBudget,
                    lifetimeBudget: draft.lifetimeBudget, geo: draft.geo,
                    creativeHash: draft.creativeHash, creativeVideoId: draft.creativeVideoId, creativeName: draft.creativeName,
                  }
                  send(msg, { campaignBrief: brief })
                }}
                onClose={() => setWizardOpen(false)}
              />
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && !wizardOpen && (
            <div className="space-y-8">
              {messages.map((msg, i) => {
                const isLast = i === messages.length - 1
                const showCursor = isLast && isStreaming && msg.role === "assistant"
                const showToolActivity = isLast && loading && activeTools.length > 0

                return (
                  <div key={i} className={cn("flex gap-4", msg.role === "user" ? "justify-end" : "justify-start items-start")}>

                    {/* Bot avatar */}
                    {msg.role === "assistant" && (
                      <div className={cn(
                        "shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5 transition-all",
                        loading && isLast
                          ? "bg-violet-500/20 ring-1 ring-violet-500/40 shadow-[0_0_16px_rgba(139,92,246,0.25)]"
                          : "bg-white/[0.05] ring-1 ring-white/[0.08]"
                      )}>
                        <Bot size={14} className={cn("text-violet-400", loading && isLast && "animate-pulse")} />
                      </div>
                    )}

                    <div className={cn("flex flex-col gap-3", msg.role === "user" ? "items-end max-w-[75%]" : "flex-1 min-w-0")}>

                      {/* Media bubble */}
                      {msg.mediaUpload ? (
                        <div className="flex items-center gap-3 bg-white/[0.05] ring-1 ring-white/[0.08] rounded-2xl rounded-tr-sm px-4 py-3">
                          {msg.mediaUpload.type === "video"
                            ? <Film size={14} className="text-violet-400 shrink-0" />
                            : <Image size={14} className="text-violet-400 shrink-0" />}
                          <div>
                            <p className="text-[13px] text-zinc-200 font-medium">{msg.mediaUpload.name}</p>
                            <p className="text-[11px] text-zinc-600 font-mono mt-0.5">
                              {msg.mediaUpload.videoId ? `video_id: ${msg.mediaUpload.videoId}` : `hash: ${msg.mediaUpload.hash}`}
                            </p>
                          </div>
                        </div>
                      ) : msg.campaignBrief ? (
                        <CampaignBriefCard b={msg.campaignBrief} />
                      ) : msg.role === "user" ? (
                        /* User bubble */
                        <div className="bg-zinc-800/80 ring-1 ring-white/[0.09] rounded-2xl rounded-tr-sm px-5 py-3.5 text-[14px] text-zinc-100 leading-relaxed">
                          {msg.content}
                        </div>
                      ) : (
                        /* Assistant message */
                        <div className={cn("text-[14px] leading-[1.75] space-y-0.5 w-full", msg.isError ? "text-red-400" : "text-zinc-300")}>

                          {/* Tool activity pills */}
                          {showToolActivity && (
                            <div className="flex flex-wrap gap-2 mb-3">
                              {activeTools.map(tool => (
                                <span key={tool.name} className={cn(
                                  "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium ring-1 transition-all",
                                  tool.status === "running" ? "text-violet-300 bg-violet-500/10 ring-violet-500/20" :
                                  tool.status === "done"    ? "text-emerald-300 bg-emerald-500/8 ring-emerald-500/15" :
                                                              "text-red-300 bg-red-500/8 ring-red-500/15"
                                )}>
                                  {tool.status === "running" ? (
                                    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="10" strokeLinecap="round" />
                                    </svg>
                                  ) : tool.status === "done" ? (
                                    <CheckCircle2 size={11} />
                                  ) : (
                                    <XCircle size={11} />
                                  )}
                                  {TOOL_LABELS[tool.name] ?? tool.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Thinking animation — before first text */}
                          {isLast && loading && !msg.content && !showToolActivity && (
                            <div className="flex items-center gap-1.5 py-2">
                              {[0, 160, 320].map(delay => (
                                <span key={delay} className="w-2 h-2 rounded-full bg-zinc-600 animate-bounce inline-block"
                                  style={{ animationDelay: `${delay}ms`, animationDuration: "1.2s" }} />
                              ))}
                            </div>
                          )}

                          {/* Rendered text + cursor */}
                          {msg.content && (
                            <div>
                              {renderMd(msg.content)}
                              {showCursor && (
                                <span className="inline-block w-[3px] h-4 bg-zinc-400/70 ml-0.5 animate-pulse align-middle rounded-full" />
                              )}
                            </div>
                          )}

                          {/* Historic tool pills */}
                          {!isLast && msg.tools_used && msg.tools_used.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {[...new Map(msg.tools_used.map(t => [t.name, t])).values()].map((t, j) => (
                                <span key={j} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] text-zinc-600 bg-white/[0.03] ring-1 ring-white/[0.06]">
                                  <CheckCircle2 size={9} className="text-emerald-500/60" />
                                  {TOOL_LABELS[t.name] ?? t.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Actions taken */}
                          {msg.actions && msg.actions.length > 0 && (
                            <div className="mt-4 space-y-1.5">
                              {msg.actions.map((a, j) => (
                                <div key={j} className="flex items-center gap-3 px-4 py-2.5 bg-emerald-500/5 ring-1 ring-emerald-500/15 rounded-xl">
                                  <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
                                  <span className="text-[13px] text-emerald-300 font-medium">{TOOL_LABELS[a.tool] ?? a.tool}</span>
                                  <span className="text-[12px] text-emerald-600">executado com sucesso</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ── Confirmation card ── */}
                      {msg.role === "assistant" && isLast && isConfirm && (
                        <div className="mt-2 w-full rounded-2xl overflow-hidden ring-1 ring-white/[0.1] bg-zinc-900">
                          <button onClick={() => send("Sim, pode implementar")}
                            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-emerald-500/5 border-b border-white/[0.06] transition-colors text-left group">
                            <span className="shrink-0 w-8 h-8 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center">
                              <Check size={14} className="text-emerald-400" />
                            </span>
                            <div className="flex-1">
                              <span className="text-[14px] font-medium text-zinc-100 group-hover:text-white">Sim, pode implementar</span>
                              <p className="text-[12px] text-zinc-600 mt-0.5">Executar a ação proposta</p>
                            </div>
                            <ChevronRight size={16} className="text-zinc-700 group-hover:text-zinc-400 shrink-0" />
                          </button>
                          <button onClick={() => send("Não, precisa ajustar")}
                            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04] border-b border-white/[0.06] transition-colors text-left group">
                            <span className="shrink-0 w-8 h-8 rounded-xl bg-white/[0.05] ring-1 ring-white/[0.08] flex items-center justify-center">
                              <ThumbsDown size={13} className="text-zinc-500" />
                            </span>
                            <div className="flex-1">
                              <span className="text-[14px] font-medium text-zinc-400 group-hover:text-zinc-200">Não, precisa ajustar</span>
                              <p className="text-[12px] text-zinc-600 mt-0.5">Revisar antes de executar</p>
                            </div>
                            <ChevronRight size={16} className="text-zinc-700 group-hover:text-zinc-400 shrink-0" />
                          </button>
                          <button onClick={() => { setTimeout(() => textareaRef.current?.focus(), 50) }}
                            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.04] transition-colors text-left group">
                            <span className="shrink-0 w-8 h-8 rounded-xl bg-white/[0.05] ring-1 ring-white/[0.08] flex items-center justify-center">
                              <MessageSquare size={13} className="text-zinc-500" />
                            </span>
                            <div className="flex-1">
                              <span className="text-[14px] font-medium text-zinc-400 group-hover:text-zinc-200">Quero discutir mais</span>
                              <p className="text-[12px] text-zinc-600 mt-0.5">Continuar a conversa</p>
                            </div>
                            <ChevronRight size={16} className="text-zinc-700 group-hover:text-zinc-400 shrink-0" />
                          </button>
                        </div>
                      )}

                      {/* ── Quick reply cards ── */}
                      {msg.role === "assistant" && isLast && quickReplies && !isConfirm && (
                        <div className="mt-2 w-full rounded-2xl overflow-hidden ring-1 ring-white/[0.1] bg-zinc-900">
                          {quickReplies.map((qr, idx) => (
                            <button key={qr.value} onClick={() => send(qr.label)} disabled={loading}
                              className={cn(
                                "w-full flex items-center gap-4 px-5 py-4 hover:bg-white/[0.05] transition-colors text-left group disabled:opacity-40",
                                idx < quickReplies.length - 1 && "border-b border-white/[0.06]"
                              )}>
                              <span className="shrink-0 w-8 h-8 rounded-xl bg-white/[0.05] ring-1 ring-white/[0.08] flex items-center justify-center text-[12px] font-bold text-zinc-500 group-hover:text-zinc-200 group-hover:bg-white/[0.09] transition-colors">
                                {idx + 1}
                              </span>
                              <span className="flex-1 text-[14px] text-zinc-300 group-hover:text-white leading-snug transition-colors">
                                {qr.label}
                              </span>
                              <ChevronRight size={16} className="shrink-0 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              <div ref={bottomRef} className="h-4" />
            </div>
          )}
        </div>
      </div>

      {/* ── Input area ── */}
      <div className="shrink-0 pb-6 pt-2">
        <div className="max-w-[700px] mx-auto">
          <div ref={skillsRef} className="relative">

            {/* Skills popover */}
            {skillsOpen && skills.length > 0 && (
              <div className="absolute bottom-full mb-3 left-0 w-full bg-zinc-900 ring-1 ring-white/[0.1] rounded-2xl overflow-hidden z-30 shadow-2xl">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Skills</span>
                  <button onClick={() => setSkillsOpen(false)} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                    <X size={13} />
                  </button>
                </div>
                <div className="py-1.5 max-h-64 overflow-y-auto">
                  {skills.map(skill => {
                    const Icon = SKILL_ICONS[skill.icon] ?? Zap
                    return (
                      <button key={skill.id} onClick={() => { send(skill.prompt); setSkillsOpen(false) }} disabled={loading}
                        className="w-full flex items-start gap-3 px-5 py-3 hover:bg-white/[0.04] transition-colors text-left group disabled:opacity-40">
                        <div className="mt-0.5 shrink-0 w-6 h-6 rounded-lg bg-violet-500/10 flex items-center justify-center">
                          <Icon size={12} className="text-violet-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-zinc-200 group-hover:text-white">{skill.name}</p>
                          <p className="text-[12px] text-zinc-600 truncate mt-0.5">{skill.prompt.slice(0, 65)}…</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Input box */}
            <div className="bg-zinc-900 ring-1 ring-white/[0.1] rounded-3xl transition-all focus-within:ring-white/[0.17] focus-within:shadow-[0_0_0_3px_rgba(139,92,246,0.06)] overflow-hidden">
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={e => {
                  setInput(e.target.value)
                  e.target.style.height = "auto"
                  e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px"
                }}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
                placeholder="Pergunte sobre campanhas, métricas ou peça uma ação..."
                disabled={loading}
                className="w-full px-5 pt-4 pb-2 bg-transparent text-[14px] text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none leading-relaxed disabled:opacity-50"
              />

              <div className="flex items-center justify-between px-4 pb-3.5 pt-1">
                <div className="flex items-center gap-1">
                  <button onClick={() => setSkillsOpen(v => !v)} disabled={skills.length === 0}
                    className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all disabled:opacity-20",
                      skillsOpen ? "text-violet-300 bg-violet-500/10 ring-1 ring-violet-500/20" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05]"
                    )}>
                    <Sparkles size={12} /> Skills
                  </button>

                  <button onClick={() => setWizardOpen(v => !v)} disabled={loading}
                    className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium transition-all disabled:opacity-40",
                      wizardOpen ? "text-violet-300 bg-violet-500/10 ring-1 ring-violet-500/20" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05]"
                    )}>
                    <Plus size={12} /> Campanha
                  </button>

                  <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = "" }} />
                  <button onClick={() => fileRef.current?.click()} disabled={loading || uploading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] transition-all disabled:opacity-40">
                    {uploading ? <Upload size={12} className="animate-bounce" /> : <Paperclip size={12} />}
                    <span>{uploading ? "Enviando…" : "Mídia"}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Model picker */}
                  <div className="relative">
                    <button onClick={() => setModelOpen(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-medium text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] transition-all">
                      {MODELS.find(m => m.id === model)?.label ?? "Sonnet 4.6"}
                      <ChevronDown size={10} className={cn("transition-transform", modelOpen && "rotate-180")} />
                    </button>
                    {modelOpen && (
                      <div className="absolute bottom-full mb-2 right-0 bg-zinc-900 ring-1 ring-white/[0.1] rounded-2xl overflow-hidden z-20 min-w-[160px] shadow-2xl">
                        {MODELS.map(m => (
                          <button key={m.id} onClick={() => { setModel(m.id); setModelOpen(false) }}
                            className={cn("w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.05] transition-colors",
                              model === m.id ? "text-white" : "text-zinc-400")}>
                            <span className="text-[13px] font-medium">{m.label}</span>
                            <span className="text-[11px] text-zinc-600">{m.desc}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Send button */}
                  <button onClick={() => send(input)} disabled={loading || !input.trim()}
                    className={cn(
                      "w-8 h-8 flex items-center justify-center rounded-xl transition-all",
                      input.trim() && !loading
                        ? "bg-white text-zinc-900 hover:bg-zinc-100 shadow-sm"
                        : "bg-white/[0.06] text-zinc-700 cursor-default"
                    )}>
                    <ArrowUp size={15} />
                  </button>
                </div>
              </div>
            </div>

            <p className="text-center text-[11px] text-zinc-700 mt-2.5">
              GTPRO pode cometer erros — verifique decisões importantes.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
