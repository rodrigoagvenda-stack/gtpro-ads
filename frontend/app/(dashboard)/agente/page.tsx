"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { api } from "@/lib/api"
import {
  ArrowUp, Bot, Search, BarChart2, Zap, Bell, Power, DollarSign,
  CheckCircle2, Sparkles, ChevronDown, ChevronRight, Trash2, FileText,
  Users, Image, X, ListChecks, XCircle, RefreshCw, Paperclip, Upload,
  Film, Check, ThumbsDown, MessageSquare, Square,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToolCall { name: string; input: Record<string, any> }
interface Action   { tool: string; input: Record<string, any>; result: any }
interface Message  {
  role: "user" | "assistant"
  content: string
  tools_used?: ToolCall[]
  actions?: Action[]
  mediaUpload?: { name: string; type: string; hash?: string; videoId?: string }
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
  get_campaigns: "Campanhas", get_account_insights: "Insights", get_campaign_insights: "Análise",
  get_insights_breakdown: "Breakdown", get_adsets: "Conjuntos", get_ads: "Anúncios",
  create_campaign: "Criando campanha", update_campaign: "Atualizando campanha",
  duplicate_campaign: "Duplicando", delete_campaign: "Deletando", toggle_campaign: "Alternando status",
  create_adset: "Criando conjunto", update_adset: "Atualizando conjunto",
  create_ad: "Criando anúncio", update_ad: "Atualizando anúncio",
  get_pixels: "Pixels", get_audiences: "Públicos",
  create_lookalike_audience: "Lookalike", create_website_audience: "Público website",
  get_account_info: "Conta", check_whatsapp_status: "WhatsApp", generate_utm: "UTM",
}

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5",  desc: "Rápido" },
  { id: "claude-sonnet-4-6",         label: "Sonnet 4.6", desc: "Equilibrado" },
  { id: "claude-opus-4-7",           label: "Opus 4.7",   desc: "Mais capaz" },
]

const SUGGESTIONS = [
  { icon: BarChart2, text: "Analise a performance dos últimos 7 dias", color: "text-violet-400" },
  { icon: Search,    text: "Quais campanhas estão com ROAS abaixo do mínimo?", color: "text-blue-400" },
  { icon: DollarSign, text: "Alguma campanha com CPL muito alto?", color: "text-emerald-400" },
  { icon: Zap,       text: "Crie uma nova campanha de captação", color: "text-amber-400" },
]

const SKILL_ICONS: Record<string, any> = {
  BarChart2, Zap, Search, FileText, Users, Image, Bell, DollarSign, Power,
}

const SKILL_COLORS: Record<string, string> = {
  violet:  "text-violet-400 bg-violet-500/10",
  blue:    "text-blue-400   bg-blue-500/10",
  emerald: "text-emerald-400 bg-emerald-500/10",
  amber:   "text-amber-400  bg-amber-500/10",
  red:     "text-red-400    bg-red-500/10",
}

// ─── Markdown renderer ────────────────────────────────────────────────────────

function inlineMd(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return <strong key={i} className="text-zinc-100 font-semibold">{p.slice(2,-2)}</strong>
    if (p.startsWith("`") && p.endsWith("`"))
      return <code key={i} className="text-violet-300 bg-violet-500/10 px-1.5 py-0.5 rounded text-[11px] font-mono">{p.slice(1,-1)}</code>
    return p
  })
}

function renderMd(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return <p key={i} className="text-[13px] font-semibold text-zinc-100 mt-5 mb-1.5">{line.slice(4)}</p>
    if (line.startsWith("## "))  return <p key={i} className="text-[14px] font-semibold text-zinc-100 mt-5 mb-1.5">{line.slice(3)}</p>
    if (line.startsWith("# "))   return <p key={i} className="text-[15px] font-bold text-white mt-5 mb-2">{line.slice(2)}</p>
    if (line.startsWith("---"))  return <hr key={i} className="border-white/[0.08] my-3" />
    if (line.startsWith("- ") || line.startsWith("• ")) return (
      <div key={i} className="flex gap-2.5 items-start my-0.5">
        <span className="text-zinc-600 mt-[5px] shrink-0 w-1 h-1 rounded-full bg-zinc-600 inline-block" />
        <span>{inlineMd(line.slice(2))}</span>
      </div>
    )
    if (/^\d+\.\s/.test(line)) return (
      <div key={i} className="flex gap-2.5 items-start my-0.5">
        <span className="text-zinc-500 text-[11px] mt-0.5 shrink-0 tabular-nums">{line.match(/^(\d+)/)?.[1]}.</span>
        <span>{inlineMd(line.replace(/^\d+\.\s/, ""))}</span>
      </div>
    )
    if (line.startsWith("|")) return <p key={i} className="my-0.5 text-zinc-400 font-mono text-[11px]">{line}</p>
    if (line === "") return <div key={i} className="h-2.5" />
    return <p key={i} className="my-0.5 leading-relaxed">{inlineMd(line)}</p>
  })
}

// ─── Quick reply extraction ───────────────────────────────────────────────────

function extractQuickReplies(content: string): { label: string; value: string }[] | null {
  const lines = content.split("\n").map(l => l.trim()).filter(Boolean)
  const hasQ  = CHOICE_RE.test(content)

  const numbered = lines.filter(l => /^\d+\.\s.+/.test(l))
  if (numbered.length >= 2 && numbered.length <= 6 && hasQ) {
    return numbered.map((l, i) => ({ label: l.replace(/^\d+\.\s/, "").trim(), value: String(i + 1) }))
  }
  const bullets = lines.filter(l => /^[-•*]\s.+/.test(l))
  if (bullets.length >= 2 && bullets.length <= 6 && hasQ) {
    return bullets.map((l, i) => ({ label: l.replace(/^[-•*]\s/, "").trim(), value: String(i + 1) }))
  }
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
    setLoading(false)
    setIsStreaming(false)
    setActiveTools([])
  }

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"

    const userMsg: Message = { role: "user", content: text }
    setMessages(p => [...p, userMsg, { role: "assistant", content: "", tools_used: [], actions: [] }])
    setLoading(true)
    setIsStreaming(false)
    setActiveTools([])

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
              : `Erro ao processar: ${msg || "verifique as configurações."}`,
            isError: true
          }
        return msgs
      })
    } finally {
      setLoading(false)
      setIsStreaming(false)
      setActiveTools([])
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
        <div className="flex items-center gap-2 text-[13px] text-zinc-600">
          <div className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: "300ms" }} />
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
      <div className="flex items-center justify-between py-2 shrink-0">
        <button onClick={() => { if (!logsOpen) loadLogs(); setLogsOpen(v => !v) }}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg transition-colors",
            logsOpen ? "text-violet-400 bg-violet-500/10" : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04]"
          )}>
          <ListChecks size={11} />
          Logs
          <ChevronDown size={9} className={cn("transition-transform", logsOpen && "rotate-180")} />
        </button>
        <div className="flex items-center gap-1">
          {loading && (
            <button onClick={stopStreaming}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
              <Square size={9} /> Parar
            </button>
          )}
          {messages.length > 0 && !loading && (
            <button onClick={clearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
              <Trash2 size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Logs panel */}
      {logsOpen && (
        <div className="shrink-0 mb-3 bg-[#0e0e11] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Últimas 30 ações</span>
            <button onClick={loadLogs} disabled={logsLoading} className="text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-40">
              <RefreshCw size={10} className={cn(logsLoading && "animate-spin")} />
            </button>
          </div>
          <div className="max-h-44 overflow-y-auto divide-y divide-white/[0.04]">
            {logsLoading && <div className="px-4 py-3 text-[11px] text-zinc-600">Carregando...</div>}
            {!logsLoading && logs.length === 0 && <div className="px-4 py-3 text-[11px] text-zinc-600">Nenhuma ação registrada.</div>}
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-3 px-4 py-2">
                {log.status === "success"
                  ? <CheckCircle2 size={10} className="text-emerald-400 shrink-0 mt-0.5" />
                  : <XCircle size={10} className="text-red-400 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-medium text-zinc-300">{log.action}</span>
                  {log.status !== "success" && log.result?.error && (
                    <p className="text-[10px] text-red-400/70 mt-0.5">{log.result.error}</p>
                  )}
                </div>
                <span className="text-[10px] text-zinc-700 shrink-0 tabular-nums">
                  {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scroll area */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-2xl mx-auto w-full py-6 px-1">

          {/* Empty state */}
          {messages.length === 0 && !loading && (
            <div className="flex flex-col items-center gap-8 py-12">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600/20 to-violet-800/10 ring-1 ring-violet-500/20 flex items-center justify-center">
                  <Sparkles size={20} className="text-violet-400" />
                </div>
                <div className="text-center">
                  <p className="text-[17px] font-semibold text-white">Como posso ajudar?</p>
                  <p className="text-[12px] text-zinc-500 mt-1">Analiso, otimizo e executo no Meta Ads.</p>
                </div>
              </div>
              {skills.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                  {skills.map(skill => {
                    const Icon = SKILL_ICONS[skill.icon] ?? Zap
                    const cls  = SKILL_COLORS[skill.color] ?? SKILL_COLORS.violet
                    return (
                      <button key={skill.id} onClick={() => send(skill.prompt)}
                        className="text-left px-4 py-3.5 bg-white/[0.03] ring-1 ring-white/[0.06] rounded-xl hover:bg-white/[0.06] transition-all group">
                        <div className="flex items-center gap-2.5 mb-1">
                          <Icon size={12} className={cls.split(" ")[0]} />
                          <span className="text-[12px] font-medium text-zinc-200 group-hover:text-white">{skill.name}</span>
                        </div>
                        <p className="text-[11px] text-zinc-600 leading-snug line-clamp-2">{skill.prompt.slice(0, 80)}…</p>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
                  {SUGGESTIONS.map(s => (
                    <button key={s.text} onClick={() => send(s.text)}
                      className="flex items-start gap-2.5 text-left px-4 py-3.5 bg-white/[0.03] ring-1 ring-white/[0.06] rounded-xl hover:bg-white/[0.06] transition-all group">
                      <s.icon size={12} className={cn(s.color, "mt-0.5 shrink-0")} />
                      <span className="text-[12px] text-zinc-400 group-hover:text-zinc-200 leading-snug transition-colors">{s.text}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step progress bar */}
          {inFlow && currentStep >= 0 && (
            <div className="mb-5 px-1">
              <div className="flex items-center gap-1">
                {CREATION_STEPS.map((label, i) => (
                  <div key={label} className="flex-1 flex flex-col items-center gap-1">
                    <div className={cn("h-0.5 w-full rounded-full transition-all duration-500",
                      i < currentStep  ? "bg-violet-500" :
                      i === currentStep ? "bg-violet-400" : "bg-white/[0.07]"
                    )} />
                    {i === currentStep && <span className="text-[9px] text-violet-400">{label}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.length > 0 && (
            <div className="space-y-7">
              {messages.map((msg, i) => {
                const isLast = i === messages.length - 1
                const showCursor = isLast && isStreaming && msg.role === "assistant"
                const showToolActivity = isLast && loading && activeTools.length > 0

                return (
                  <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start items-start")}>

                    {msg.role === "assistant" && (
                      <div className={cn(
                        "shrink-0 w-6 h-6 rounded-lg flex items-center justify-center mt-0.5 transition-all",
                        loading && isLast
                          ? "bg-violet-500/20 ring-1 ring-violet-500/30 shadow-[0_0_12px_rgba(139,92,246,0.2)]"
                          : "bg-violet-600/10 ring-1 ring-violet-500/15"
                      )}>
                        <Bot size={12} className={cn("text-violet-400", loading && isLast && "animate-pulse")} />
                      </div>
                    )}

                    <div className={cn("flex flex-col gap-2", msg.role === "user" ? "items-end max-w-[78%]" : "flex-1 min-w-0")}>

                      {/* Media bubble */}
                      {msg.mediaUpload ? (
                        <div className="flex items-center gap-2.5 bg-white/[0.05] ring-1 ring-white/[0.08] rounded-2xl rounded-tr-sm px-4 py-2.5">
                          {msg.mediaUpload.type === "video"
                            ? <Film size={13} className="text-violet-400 shrink-0" />
                            : <Image size={13} className="text-violet-400 shrink-0" />}
                          <div>
                            <p className="text-[12px] text-zinc-200 font-medium">{msg.mediaUpload.name}</p>
                            <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
                              {msg.mediaUpload.videoId ? `video_id: ${msg.mediaUpload.videoId}` : `hash: ${msg.mediaUpload.hash}`}
                            </p>
                          </div>
                        </div>
                      ) : msg.role === "user" ? (
                        <div className="bg-zinc-800 ring-1 ring-white/[0.08] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] text-zinc-100 leading-relaxed">
                          {msg.content}
                        </div>
                      ) : (
                        <div className={cn("text-[13px] leading-relaxed space-y-0.5", msg.isError ? "text-red-400" : "text-zinc-300")}>

                          {/* Tool activity inline */}
                          {showToolActivity && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {activeTools.map(tool => (
                                <span key={tool.name} className={cn(
                                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ring-1 transition-all",
                                  tool.status === "running" ? "text-violet-400 bg-violet-500/10 ring-violet-500/20" :
                                  tool.status === "done"    ? "text-emerald-400 bg-emerald-500/8 ring-emerald-500/15" :
                                                              "text-red-400 bg-red-500/8 ring-red-500/15"
                                )}>
                                  {tool.status === "running" ? (
                                    <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeDashoffset="10" strokeLinecap="round" />
                                    </svg>
                                  ) : tool.status === "done" ? (
                                    <CheckCircle2 size={9} />
                                  ) : (
                                    <XCircle size={9} />
                                  )}
                                  {TOOL_LABELS[tool.name] ?? tool.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Thinking dots — before first text */}
                          {isLast && loading && !msg.content && !showToolActivity && (
                            <div className="flex items-center gap-1 py-1">
                              {[0, 150, 300].map(delay => (
                                <span key={delay} className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce inline-block"
                                  style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }} />
                              ))}
                            </div>
                          )}

                          {/* Rendered text + cursor */}
                          {msg.content && (
                            <>
                              {renderMd(msg.content)}
                              {showCursor && <span className="inline-block w-0.5 h-3.5 bg-zinc-400 ml-0.5 animate-pulse align-middle" />}
                            </>
                          )}

                          {/* Tool used pills (historic) */}
                          {!isLast && msg.tools_used && msg.tools_used.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {[...new Map(msg.tools_used.map(t => [t.name, t])).values()].map((t, j) => (
                                <span key={j} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] text-zinc-600 bg-white/[0.03] ring-1 ring-white/[0.06]">
                                  <CheckCircle2 size={8} className="text-emerald-500/60" />
                                  {TOOL_LABELS[t.name] ?? t.name}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Actions taken */}
                          {msg.actions && msg.actions.length > 0 && (
                            <div className="mt-3 space-y-1">
                              {msg.actions.map((a, j) => (
                                <div key={j} className="flex items-center gap-2 px-3 py-2 bg-emerald-500/5 ring-1 ring-emerald-500/15 rounded-lg">
                                  <CheckCircle2 size={11} className="text-emerald-400 shrink-0" />
                                  <span className="text-[12px] text-emerald-300 font-medium">{TOOL_LABELS[a.tool] ?? a.tool}</span>
                                  <span className="text-[11px] text-emerald-500/60">executado</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Confirmation buttons */}
                      {msg.role === "assistant" && isLast && isConfirm && (
                        <div className="mt-3 w-full rounded-xl overflow-hidden ring-1 ring-white/[0.09] divide-y divide-white/[0.07]">
                          <button onClick={() => send("Sim, pode implementar")}
                            className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#0f0f12] hover:bg-emerald-500/5 hover:ring-emerald-500/20 transition-colors text-left group">
                            <span className="shrink-0 w-5 h-5 rounded-md bg-emerald-500/10 flex items-center justify-center">
                              <Check size={11} className="text-emerald-400" />
                            </span>
                            <span className="flex-1 text-[13px] text-zinc-200 group-hover:text-white">Sim, pode implementar</span>
                            <ChevronRight size={13} className="text-zinc-700 group-hover:text-zinc-400 shrink-0" />
                          </button>
                          <button onClick={() => send("Não, precisa ajustar")}
                            className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#0f0f12] hover:bg-white/[0.04] transition-colors text-left group">
                            <span className="shrink-0 w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center">
                              <ThumbsDown size={10} className="text-zinc-500" />
                            </span>
                            <span className="flex-1 text-[13px] text-zinc-400 group-hover:text-zinc-200">Não, precisa ajustar</span>
                            <ChevronRight size={13} className="text-zinc-700 group-hover:text-zinc-400 shrink-0" />
                          </button>
                          <button onClick={() => { setTimeout(() => textareaRef.current?.focus(), 50) }}
                            className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#0f0f12] hover:bg-white/[0.04] transition-colors text-left group">
                            <span className="shrink-0 w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center">
                              <MessageSquare size={10} className="text-zinc-500" />
                            </span>
                            <span className="flex-1 text-[13px] text-zinc-400 group-hover:text-zinc-200">Quero discutir mais</span>
                            <ChevronRight size={13} className="text-zinc-700 group-hover:text-zinc-400 shrink-0" />
                          </button>
                        </div>
                      )}

                      {/* Claude-style numbered option cards */}
                      {msg.role === "assistant" && isLast && quickReplies && !isConfirm && (
                        <div className="mt-3 w-full rounded-xl overflow-hidden ring-1 ring-white/[0.09] divide-y divide-white/[0.07]">
                          {quickReplies.map((qr, idx) => (
                            <button key={qr.value} onClick={() => send(qr.label)} disabled={loading}
                              className="w-full flex items-center gap-3 px-4 py-3.5 bg-[#0f0f12] hover:bg-white/[0.05] transition-colors text-left group disabled:opacity-40">
                              <span className="shrink-0 w-5 h-5 rounded-md bg-white/[0.06] flex items-center justify-center text-[10px] font-bold text-zinc-500 group-hover:text-zinc-300 group-hover:bg-white/[0.10] transition-colors">
                                {idx + 1}
                              </span>
                              <span className="flex-1 text-[13px] text-zinc-300 group-hover:text-white leading-snug transition-colors">
                                {qr.label}
                              </span>
                              <ChevronRight size={13} className="shrink-0 text-zinc-700 group-hover:text-zinc-400 transition-colors" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              <div ref={bottomRef} className="h-2" />
            </div>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className="shrink-0 pb-5 pt-2">
        <div className="max-w-2xl mx-auto">
          <div ref={skillsRef} className="relative bg-zinc-900/80 ring-1 ring-white/[0.08] rounded-2xl backdrop-blur-sm transition-all focus-within:ring-white/[0.13]">

            {/* Skills popover */}
            {skillsOpen && skills.length > 0 && (
              <div className="absolute bottom-full mb-2 left-0 w-full bg-[#16161a] ring-1 ring-white/[0.09] rounded-xl overflow-hidden z-30 shadow-2xl">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
                  <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Skills</span>
                  <button onClick={() => setSkillsOpen(false)} className="text-zinc-600 hover:text-zinc-400"><X size={12} /></button>
                </div>
                <div className="py-1 max-h-64 overflow-y-auto">
                  {skills.map(skill => {
                    const Icon = SKILL_ICONS[skill.icon] ?? Zap
                    const cls  = SKILL_COLORS[skill.color] ?? SKILL_COLORS.violet
                    return (
                      <button key={skill.id} onClick={() => { send(skill.prompt); setSkillsOpen(false) }} disabled={loading}
                        className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-white/[0.04] transition-colors text-left group disabled:opacity-40">
                        <div className={cn("mt-0.5 shrink-0 w-5 h-5 rounded-md flex items-center justify-center", cls.split(" ").slice(1).join(" "))}>
                          <Icon size={11} className={cls.split(" ")[0]} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-zinc-200 group-hover:text-white">{skill.name}</p>
                          <p className="text-[11px] text-zinc-600 truncate mt-0.5">{skill.prompt.slice(0, 65)}…</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <textarea ref={textareaRef} rows={1} value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px" }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder="Responder..."
              disabled={loading}
              className="w-full px-4 pt-3.5 pb-2 bg-transparent text-[13px] text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none leading-relaxed disabled:opacity-50"
            />

            <div className="flex items-center justify-between px-3 pb-2.5 pt-0.5">
              <div className="flex items-center gap-0.5">
                <button onClick={() => setSkillsOpen(v => !v)} disabled={skills.length === 0}
                  className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors disabled:opacity-20",
                    skillsOpen ? "text-violet-400 bg-violet-500/10" : "text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04]"
                  )}>
                  <Sparkles size={11} /><span>Skills</span>
                </button>

                <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = "" }} />
                <button onClick={() => fileRef.current?.click()} disabled={loading || uploading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-colors disabled:opacity-40">
                  {uploading ? <Upload size={11} className="animate-bounce" /> : <Paperclip size={11} />}
                  <span>{uploading ? "Enviando…" : "Mídia"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <button onClick={() => setModelOpen(v => !v)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.04] transition-colors">
                    {MODELS.find(m => m.id === model)?.label ?? "Sonnet 4.6"}
                    <ChevronDown size={9} className={cn("transition-transform", modelOpen && "rotate-180")} />
                  </button>
                  {modelOpen && (
                    <div className="absolute bottom-full mb-1.5 right-0 bg-[#1a1a1e] ring-1 ring-white/[0.09] rounded-xl overflow-hidden z-20 min-w-[155px] shadow-xl">
                      {MODELS.map(m => (
                        <button key={m.id} onClick={() => { setModel(m.id); setModelOpen(false) }}
                          className={cn("w-full flex items-center justify-between px-4 py-2.5 hover:bg-white/[0.04] transition-colors",
                            model === m.id ? "text-white" : "text-zinc-400")}>
                          <span className="text-[12px] font-medium">{m.label}</span>
                          <span className="text-[10px] text-zinc-600">{m.desc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button onClick={() => send(input)} disabled={loading || !input.trim()}
                  className={cn("w-7 h-7 flex items-center justify-center rounded-lg transition-all",
                    input.trim() && !loading ? "bg-white text-zinc-900 hover:bg-zinc-100 shadow-sm" : "bg-white/[0.05] text-zinc-700 cursor-default"
                  )}>
                  <ArrowUp size={13} />
                </button>
              </div>
            </div>
          </div>
          <p className="text-center text-[10px] text-zinc-700 mt-2">GTPRO pode cometer erros — verifique decisões importantes.</p>
        </div>
      </div>
    </div>
  )
}
