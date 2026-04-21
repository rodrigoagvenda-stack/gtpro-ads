"use client"

import { useState, useRef, useEffect } from "react"
import { api } from "@/lib/api"
import {
  ArrowUp, Bot, Search, BarChart2, Zap, Bell, Power, DollarSign,
  CheckCircle2, Sparkles, ChevronDown, Trash2, FileText, Users,
  Image, X, ListChecks, XCircle, RefreshCw, Paperclip, Upload, Film,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface ToolCall { name: string; input: Record<string, any> }
interface Action   { tool: string; input: Record<string, any>; result: any }
interface Message  {
  role: "user" | "assistant"
  content: string
  tools_used?: ToolCall[]
  actions?: Action[]
  mediaUpload?: { name: string; type: string; hash?: string; videoId?: string }
}
interface LogEntry {
  id: string; action: string
  params: Record<string, any> | null
  result: Record<string, any> | null
  status: string; created_at: string
}

// ─── Quick-reply extraction ───────────────────────────────────────────────────
function extractQuickReplies(content: string): { label: string; value: string }[] | null {
  const lines    = content.split("\n").map(l => l.trim()).filter(Boolean)
  const numbered = lines.filter(l => /^\d+\.\s.+/.test(l))
  const last3    = lines.slice(-3).join(" ")
  const hasQ     = last3.endsWith("?") || last3.toLowerCase().includes("qual prefere") || last3.toLowerCase().includes("confirma")
  if (numbered.length >= 2 && numbered.length <= 6 && hasQ) {
    return numbered.map(l => {
      const text  = l.replace(/^\d+\.\s/, "")
      const label = text.split(" — ")[0].split(" - ")[0].trim()
      return { label, value: String(numbered.indexOf(l) + 1) }
    })
  }
  return null
}

// ─── Step progress extraction ─────────────────────────────────────────────────
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

// ─── Misc ─────────────────────────────────────────────────────────────────────

const TOOL_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  get_campaigns:   { label: "Campanhas",  icon: Search,     color: "text-blue-400",    bg: "bg-blue-500/10 ring-blue-500/20" },
  get_insights:    { label: "Métricas",   icon: BarChart2,  color: "text-violet-400",  bg: "bg-violet-500/10 ring-violet-500/20" },
  toggle_campaign: { label: "Campanha",   icon: Power,      color: "text-amber-400",   bg: "bg-amber-500/10 ring-amber-500/20" },
  update_budget:   { label: "Budget",     icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10 ring-emerald-500/20" },
  create_alert:    { label: "Alerta",     icon: Bell,       color: "text-red-400",     bg: "bg-red-500/10 ring-red-500/20" },
}

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5",  desc: "Rápido" },
  { id: "claude-sonnet-4-6",         label: "Sonnet 4.6", desc: "Equilibrado" },
  { id: "claude-opus-4-7",           label: "Opus 4.7",   desc: "Mais capaz" },
]

const THINKING_STEPS = ["Pensando...", "Buscando dados...", "Analisando..."]

const SUGGESTIONS = [
  "Quais campanhas estão com ROAS abaixo do mínimo?",
  "Analise a performance dos últimos 7 dias",
  "Quais campanhas posso pausar para economizar?",
  "Alguma campanha com CPL muito alto?",
]

const SKILL_ICONS: Record<string, any> = {
  BarChart2, Zap, Search, FileText, Users, Image, Bell, DollarSign, Power,
}

const SKILL_COLORS: Record<string, string> = {
  violet:  "text-violet-400 bg-violet-500/10 ring-violet-500/20 hover:bg-violet-500/20",
  blue:    "text-blue-400   bg-blue-500/10   ring-blue-500/20   hover:bg-blue-500/20",
  emerald: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20 hover:bg-emerald-500/20",
  amber:   "text-amber-400  bg-amber-500/10  ring-amber-500/20  hover:bg-amber-500/20",
  red:     "text-red-400    bg-red-500/10    ring-red-500/20    hover:bg-red-500/20",
}

function renderMd(text: string) {
  return text.split("\n").map((line, i) => {
    if (line.startsWith("### ")) return <p key={i} className="text-[13px] font-semibold text-white mt-4 mb-1">{line.slice(4)}</p>
    if (line.startsWith("## "))  return <p key={i} className="text-[14px] font-semibold text-white mt-4 mb-1">{line.slice(3)}</p>
    if (line.startsWith("- ") || line.startsWith("• ")) return (
      <div key={i} className="flex gap-2 items-start my-0.5">
        <span className="text-zinc-600 mt-[3px] shrink-0 text-[10px]">●</span>
        <span>{inlineMd(line.slice(2))}</span>
      </div>
    )
    if (/^\d+\. /.test(line)) return (
      <div key={i} className="flex gap-2 items-start my-0.5">
        <span className="text-zinc-600 text-[11px] mt-px shrink-0">{line.match(/^(\d+)/)?.[1]}.</span>
        <span>{inlineMd(line.replace(/^\d+\. /, ""))}</span>
      </div>
    )
    if (line === "") return <div key={i} className="h-2" />
    return <p key={i} className="my-0.5">{inlineMd(line)}</p>
  })
}

function inlineMd(text: string): React.ReactNode {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} className="text-white font-semibold">{p.slice(2,-2)}</strong>
    if (p.startsWith("`") && p.endsWith("`"))   return <code key={i} className="text-violet-300 bg-violet-500/10 px-1 rounded text-[11px] font-mono">{p.slice(1,-1)}</code>
    return p
  })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentePage() {
  const [messages, setMessages]         = useState<Message[]>([])
  const [input, setInput]               = useState("")
  const [loading, setLoading]           = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [thinkStep, setThinkStep]       = useState(0)
  const [model, setModel]               = useState("claude-sonnet-4-6")
  const [modelOpen, setModelOpen]       = useState(false)
  const [skills, setSkills]             = useState<{ id: string; name: string; icon: string; color: string; prompt: string }[]>([])
  const [skillsOpen, setSkillsOpen]     = useState(false)
  const [logs, setLogs]                 = useState<LogEntry[]>([])
  const [logsOpen, setLogsOpen]         = useState(false)
  const [logsLoading, setLogsLoading]   = useState(false)
  const [uploading, setUploading]       = useState(false)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const skillsRef   = useRef<HTMLDivElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)

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

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages, loading])

  useEffect(() => {
    if (loading) {
      intervalRef.current = setInterval(() => setThinkStep(s => Math.min(s + 1, THINKING_STEPS.length - 1)), 3000)
    } else {
      clearInterval(intervalRef.current); setThinkStep(0)
    }
    return () => clearInterval(intervalRef.current)
  }, [loading])

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

  async function send(text: string) {
    if (!text.trim() || loading) return
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
    setMessages(p => [...p, { role: "user", content: text }])
    setLoading(true)
    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }))
      const res = await api.agent.query(text, model, history)
      setMessages(p => [...p, { role: "assistant", content: res.message, tools_used: res.tools_used, actions: res.actions_taken }])
    } catch {
      setMessages(p => [...p, { role: "assistant", content: "Erro ao processar. Verifique se o agente está configurado." }])
    } finally { setLoading(false) }
  }

  async function handleFileUpload(file: File) {
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("name", file.name)
      const res = await fetch("/api/meta/media", {
        method: "POST",
        headers: { Authorization: `Bearer ${(await (await import("@/lib/supabase")).createClient().auth.getSession()).data.session?.access_token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      const isVideo = file.type.startsWith("video/")
      const info    = isVideo
        ? `Mídia enviada: "${file.name}" (vídeo, ID: ${data.meta_video_id})`
        : `Mídia enviada: "${file.name}" (imagem, hash: ${data.meta_hash})`
      setMessages(p => [...p, {
        role: "user",
        content: info,
        mediaUpload: { name: file.name, type: isVideo ? "video" : "image", hash: data.meta_hash, videoId: data.meta_video_id },
      }])
      await send(`Fiz o upload da mídia "${file.name}". ${isVideo ? `O video_id é ${data.meta_video_id}` : `O image_hash é ${data.meta_hash}`}. Pode usar no criativo.`)
    } catch (e: any) {
      alert(`Erro no upload: ${e.message}`)
    } finally { setUploading(false) }
  }

  if (loadingHistory) {
    return <div className="flex items-center justify-center py-20 text-[13px] text-zinc-600">Carregando histórico...</div>
  }

  const lastAssistant   = [...messages].reverse().find(m => m.role === "assistant")
  const quickReplies    = !loading && lastAssistant ? extractQuickReplies(lastAssistant.content) : null
  const inFlow          = isInCreationFlow(messages)
  const currentStep     = inFlow ? detectCurrentStep(messages) : -1

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 3.5rem)" }}>

      {/* Top bar */}
      <div className="flex items-center justify-between py-2 shrink-0">
        <button onClick={() => { if (!logsOpen) loadLogs(); setLogsOpen(v => !v) }}
          className={cn("flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-lg transition-colors",
            logsOpen ? "text-violet-400 bg-violet-500/10" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05]"
          )}>
          <ListChecks size={11} />
          Logs
          <ChevronDown size={10} className={cn("transition-transform", logsOpen && "rotate-180")} />
        </button>
        {messages.length > 0 && (
          <button onClick={clearHistory} className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
            <Trash2 size={11} /> Limpar
          </button>
        )}
      </div>

      {/* Logs */}
      {logsOpen && (
        <div className="shrink-0 mb-2 bg-[#0e0e11] ring-1 ring-white/[0.07] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
            <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Últimas 30 ações</span>
            <button onClick={loadLogs} disabled={logsLoading} className="text-zinc-600 hover:text-zinc-400 transition-colors disabled:opacity-40">
              <RefreshCw size={11} className={cn(logsLoading && "animate-spin")} />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto scrollbar-thin divide-y divide-white/[0.04]">
            {logsLoading && <div className="px-4 py-3 text-[11px] text-zinc-600">Carregando...</div>}
            {!logsLoading && logs.length === 0 && <div className="px-4 py-3 text-[11px] text-zinc-600">Nenhuma ação registrada.</div>}
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-3 px-4 py-2.5">
                {log.status === "success"
                  ? <CheckCircle2 size={11} className="text-emerald-400 shrink-0 mt-0.5" />
                  : <XCircle size={11} className="text-red-400 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <span className="text-[12px] font-medium text-zinc-300">{log.action}</span>
                  {log.params && Object.keys(log.params).length > 0 && (
                    <span className="ml-2 text-[10px] text-zinc-600 font-mono">{JSON.stringify(log.params).slice(0, 80)}</span>
                  )}
                  {log.status !== "success" && log.result?.error && (
                    <p className="text-[11px] text-red-400/80 mt-0.5">{log.result.error}</p>
                  )}
                </div>
                <span className="text-[10px] text-zinc-700 shrink-0">
                  {new Date(log.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scroll area */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
      <div className="max-w-2xl mx-auto w-full py-4">

      {/* Empty state */}
      {messages.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-8">
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-violet-600/15 ring-1 ring-violet-500/20 flex items-center justify-center">
              <Sparkles size={22} className="text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-[18px] font-semibold text-white">Como posso ajudar?</p>
              <p className="text-[13px] text-zinc-500 mt-1">Analiso campanhas, identifico problemas e executo otimizações no Meta Ads.</p>
            </div>
          </div>
          {skills.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg">
              {skills.map(skill => {
                const Icon = SKILL_ICONS[skill.icon] ?? Zap
                const cls  = SKILL_COLORS[skill.color] ?? SKILL_COLORS.violet
                return (
                  <button key={skill.id} onClick={() => send(skill.prompt)} disabled={loading}
                    className="text-left px-4 py-3.5 bg-white/[0.03] ring-1 ring-white/[0.07] rounded-xl hover:bg-white/[0.06] transition-all group disabled:opacity-40">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <Icon size={13} className={cn(cls.split(" ")[0], "shrink-0")} />
                      <span className="text-[13px] font-medium text-zinc-200 group-hover:text-white">{skill.name}</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 leading-snug line-clamp-2">{skill.prompt.slice(0, 80)}…</p>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => send(s)}
                  className="text-left px-4 py-3.5 bg-white/[0.03] ring-1 ring-white/[0.07] rounded-xl text-[12px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 transition-all leading-snug">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step progress bar — shown during creation flow */}
      {inFlow && currentStep >= 0 && (
        <div className="mb-4 px-1">
          <div className="flex items-center gap-1.5">
            {CREATION_STEPS.map((label, i) => (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <div className={cn("h-1 w-full rounded-full transition-colors",
                  i < currentStep  ? "bg-violet-500" :
                  i === currentStep ? "bg-violet-400 animate-pulse" :
                  "bg-white/[0.08]"
                )} />
                {i === currentStep && (
                  <span className="text-[9px] text-violet-400 font-medium">{label}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {(messages.length > 0 || loading) && (
        <div className="space-y-6">
          {messages.map((msg, i) => {
            const isLast = i === messages.length - 1
            return (
              <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start items-start")}>
                {msg.role === "assistant" && (
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-violet-600/20 ring-1 ring-violet-500/20 flex items-center justify-center mt-0.5">
                    <Bot size={13} className="text-violet-400" />
                  </div>
                )}
                <div className={cn("flex flex-col gap-2", msg.role === "user" ? "items-end max-w-[80%]" : "flex-1 min-w-0")}>
                  {/* Tool pills */}
                  {msg.role === "assistant" && msg.tools_used && msg.tools_used.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-0.5">
                      {[...new Map(msg.tools_used.map(t => [t.name, t])).values()].map((t, j) => {
                        const m = TOOL_META[t.name] ?? { label: t.name, icon: Zap, color: "text-zinc-400", bg: "bg-white/[0.04] ring-white/[0.08]" }
                        const Icon = m.icon
                        return (
                          <span key={j} className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[11px] font-medium", m.color, m.bg)}>
                            <Icon size={10} />{m.label}
                          </span>
                        )
                      })}
                    </div>
                  )}

                  {/* Media upload bubble */}
                  {msg.mediaUpload ? (
                    <div className="flex items-center gap-2.5 bg-white/[0.05] ring-1 ring-white/[0.08] rounded-2xl rounded-tr-sm px-4 py-2.5">
                      {msg.mediaUpload.type === "video"
                        ? <Film size={14} className="text-violet-400 shrink-0" />
                        : <Image size={14} className="text-violet-400 shrink-0" />}
                      <div>
                        <p className="text-[13px] text-zinc-200 font-medium">{msg.mediaUpload.name}</p>
                        <p className="text-[10px] text-zinc-600 font-mono mt-0.5">
                          {msg.mediaUpload.videoId ? `video_id: ${msg.mediaUpload.videoId}` : `hash: ${msg.mediaUpload.hash}`}
                        </p>
                      </div>
                    </div>
                  ) : msg.role === "user" ? (
                    <div className="bg-white/[0.07] ring-1 ring-white/[0.09] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] text-zinc-100 leading-relaxed">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="text-[13px] text-zinc-300 leading-relaxed space-y-0.5">
                      {renderMd(msg.content)}
                    </div>
                  )}

                  {/* Actions */}
                  {msg.role === "assistant" && msg.actions && msg.actions.length > 0 && (
                    <div className="space-y-1 mt-1 w-full">
                      {msg.actions.map((a, j) => {
                        const m = TOOL_META[a.tool] ?? TOOL_META.get_campaigns
                        const Icon = m?.icon ?? Zap
                        return (
                          <div key={j} className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] ring-1 ring-white/[0.06] rounded-lg">
                            <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                            <Icon size={11} className={m?.color ?? "text-zinc-400"} />
                            <span className="text-[12px] text-zinc-400">{m?.label ?? a.tool}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Quick reply buttons — only on last assistant message */}
                  {msg.role === "assistant" && isLast && quickReplies && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {quickReplies.map(qr => (
                        <button key={qr.value} onClick={() => send(qr.value)} disabled={loading}
                          className="px-4 py-2 bg-white/[0.05] ring-1 ring-white/[0.12] hover:bg-violet-600/20 hover:ring-violet-500/40 hover:text-violet-200 rounded-full text-[12px] text-zinc-300 transition-all font-medium disabled:opacity-40">
                          {qr.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Thinking */}
          {loading && (
            <div className="flex gap-3 items-start">
              <div className="shrink-0 w-7 h-7 rounded-lg bg-violet-600/20 ring-1 ring-violet-500/20 flex items-center justify-center mt-0.5">
                <Bot size={13} className="text-violet-400 animate-pulse" />
              </div>
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white/[0.03] ring-1 ring-white/[0.06] rounded-2xl rounded-tl-sm">
                <span className="text-[12px] text-zinc-500">{THINKING_STEPS[thinkStep]}</span>
                <span className="flex gap-0.5 ml-0.5">
                  {[0,150,300].map(d => <span key={d} className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-4" />
        </div>
      )}

      </div>
      </div>

      {/* Input */}
      <div className="shrink-0 pb-5 pt-3 bg-gradient-to-t from-[#08080a] via-[#08080a]/95 to-transparent">
        <div className="max-w-2xl mx-auto">
          <div ref={skillsRef} className="relative bg-[#111113] ring-1 ring-white/[0.08] rounded-2xl transition-all focus-within:ring-white/[0.14]">

            {/* Skills popover */}
            {skillsOpen && skills.length > 0 && (
              <div className="absolute bottom-full mb-2 left-0 w-full bg-[#16161a] ring-1 ring-white/[0.10] rounded-xl overflow-hidden z-30 shadow-xl">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                  <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Skills</span>
                  <button onClick={() => setSkillsOpen(false)} className="text-zinc-600 hover:text-zinc-400"><X size={13} /></button>
                </div>
                <div className="py-1 max-h-72 overflow-y-auto scrollbar-thin">
                  {skills.map(skill => {
                    const Icon = SKILL_ICONS[skill.icon] ?? Zap
                    const cls  = SKILL_COLORS[skill.color] ?? SKILL_COLORS.violet
                    return (
                      <button key={skill.id} onClick={() => { send(skill.prompt); setSkillsOpen(false) }} disabled={loading}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.05] transition-colors text-left group disabled:opacity-40">
                        <div className={cn("mt-0.5 shrink-0 w-6 h-6 rounded-md flex items-center justify-center", cls.split(" ").slice(1).join(" "))}>
                          <Icon size={12} className={cls.split(" ")[0]} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-zinc-200 group-hover:text-white">{skill.name}</p>
                          <p className="text-[11px] text-zinc-600 truncate mt-0.5">{skill.prompt.slice(0, 70)}…</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Textarea */}
            <textarea ref={textareaRef} rows={1} value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px" }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder="Responder..."
              disabled={loading}
              className="w-full px-4 pt-3.5 pb-2 bg-transparent text-[13px] text-white placeholder-zinc-600 focus:outline-none resize-none leading-relaxed disabled:opacity-40"
            />

            {/* Bottom bar */}
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
              <div className="flex items-center gap-1">
                {/* Skills */}
                <button onClick={() => setSkillsOpen(v => !v)} disabled={skills.length === 0}
                  className={cn("flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-colors disabled:opacity-20",
                    skillsOpen ? "text-violet-400 bg-violet-500/10" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05]"
                  )}>
                  <Sparkles size={12} /><span>Skills</span>
                </button>

                {/* Media upload */}
                <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); e.target.value = "" }}
                />
                <button onClick={() => fileRef.current?.click()} disabled={loading || uploading}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.05] transition-colors disabled:opacity-40"
                  title="Enviar imagem ou vídeo para o Meta"
                >
                  {uploading
                    ? <Upload size={12} className="animate-bounce" />
                    : <Paperclip size={12} />}
                  <span>{uploading ? "Enviando..." : "Mídia"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {/* Model selector */}
                <div className="relative">
                  <button onClick={() => setModelOpen(v => !v)}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] transition-colors">
                    {MODELS.find(m => m.id === model)?.label ?? "Sonnet 4.6"}
                    <ChevronDown size={10} className={cn("transition-transform", modelOpen && "rotate-180")} />
                  </button>
                  {modelOpen && (
                    <div className="absolute bottom-full mb-1 right-0 bg-[#1a1a1e] ring-1 ring-white/[0.10] rounded-xl overflow-hidden z-20 min-w-[160px]">
                      {MODELS.map(m => (
                        <button key={m.id} onClick={() => { setModel(m.id); setModelOpen(false) }}
                          className={cn("w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/[0.05] transition-colors", model === m.id ? "text-white" : "text-zinc-400")}>
                          <span className="text-[12px] font-medium">{m.label}</span>
                          <span className="text-[10px] text-zinc-600">{m.desc}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Send */}
                <button onClick={() => send(input)} disabled={loading || !input.trim()}
                  className={cn("w-7 h-7 flex items-center justify-center rounded-lg transition-all",
                    input.trim() && !loading ? "bg-white text-zinc-900 hover:bg-zinc-100" : "bg-white/[0.06] text-zinc-600 cursor-default"
                  )}>
                  <ArrowUp size={13} />
                </button>
              </div>
            </div>
          </div>
          <p className="text-center text-[11px] text-zinc-700 mt-2">GTPRO pode cometer erros — verifique decisões importantes.</p>
        </div>
      </div>
    </div>
  )
}
