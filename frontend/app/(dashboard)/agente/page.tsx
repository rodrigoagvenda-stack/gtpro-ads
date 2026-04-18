"use client"

import { useState, useRef, useEffect } from "react"
import { api } from "@/lib/api"
import { Send, Bot, Search, BarChart2, TrendingUp, Zap, Bell, Power, DollarSign, CheckCircle2, Clock, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface ToolCall { name: string; input: Record<string, any> }
interface Action { tool: string; input: Record<string, any>; result: any }
interface Message {
  role: "user" | "assistant"
  content: string
  tools_used?: ToolCall[]
  actions?: Action[]
}

const TOOL_META: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  get_campaigns:   { label: "Campanhas",  icon: Search,     color: "text-blue-400",    bg: "bg-blue-500/10 ring-blue-500/20" },
  get_insights:    { label: "Métricas",   icon: BarChart2,  color: "text-violet-400",  bg: "bg-violet-500/10 ring-violet-500/20" },
  toggle_campaign: { label: "Campanha",   icon: Power,      color: "text-amber-400",   bg: "bg-amber-500/10 ring-amber-500/20" },
  update_budget:   { label: "Budget",     icon: DollarSign, color: "text-emerald-400", bg: "bg-emerald-500/10 ring-emerald-500/20" },
  create_alert:    { label: "Alerta",     icon: Bell,       color: "text-red-400",     bg: "bg-red-500/10 ring-red-500/20" },
}

const STEPS = [
  { icon: Search,     text: "Consultando campanhas..." },
  { icon: BarChart2,  text: "Analisando métricas..." },
  { icon: TrendingUp, text: "Verificando ROAS e CPL..." },
  { icon: Zap,        text: "Preparando resposta..." },
]

const SUGGESTIONS = [
  "Quais campanhas estão com ROAS abaixo do mínimo?",
  "Analise a performance dos últimos 7 dias",
  "Quais campanhas posso pausar para economizar?",
  "Alguma campanha com CPL muito alto?",
]

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

export default function AgentePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (loading) {
      intervalRef.current = setInterval(() => setStep(s => (s + 1) % STEPS.length), 1800)
    } else {
      clearInterval(intervalRef.current)
      setStep(0)
    }
    return () => clearInterval(intervalRef.current)
  }, [loading])

  async function send(text: string) {
    if (!text.trim() || loading) return
    setInput("")
    if (textareaRef.current) textareaRef.current.style.height = "auto"
    setMessages(p => [...p, { role: "user", content: text }])
    setLoading(true)
    try {
      const res = await api.agent.query(text)
      setMessages(p => [...p, { role: "assistant", content: res.message, tools_used: res.tools_used, actions: res.actions_taken }])
    } catch {
      setMessages(p => [...p, { role: "assistant", content: "Erro ao processar. Verifique se o agente está configurado." }])
    } finally {
      setLoading(false)
    }
  }

  const StepIcon = STEPS[step].icon

  return (
    <div className="relative min-h-[calc(100vh-10rem)] flex flex-col">

      {/* Empty state */}
      {messages.length === 0 && !loading && (
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-6">
          <div className="w-14 h-14 rounded-2xl bg-violet-600/15 ring-1 ring-violet-500/20 flex items-center justify-center">
            <Sparkles size={22} className="text-violet-400" />
          </div>
          <div className="text-center">
            <p className="text-[18px] font-semibold text-white">Como posso ajudar?</p>
            <p className="text-[13px] text-zinc-500 mt-1.5">Analiso campanhas, identifico problemas e executo otimizações no Meta Ads.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 w-full max-w-lg mt-2">
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)}
                className="text-left px-4 py-3.5 bg-white/[0.03] ring-1 ring-white/[0.07] rounded-xl text-[12px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 transition-all leading-snug">
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      {(messages.length > 0 || loading) && (
        <div className="flex-1 py-2 space-y-8 max-w-2xl w-full mx-auto">
          {messages.map((msg, i) => (
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

                {/* Bubble */}
                {msg.role === "user" ? (
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
                      const Icon = m.icon
                      const pending = a.result?.status === "pending_approval"
                      return (
                        <div key={j} className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] ring-1 ring-white/[0.06] rounded-lg">
                          {pending ? <Clock size={12} className="text-amber-400 shrink-0" /> : <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />}
                          <Icon size={11} className={m.color} />
                          <span className="text-[12px] text-zinc-400">{m.label}</span>
                          {pending && <span className="ml-auto text-[11px] text-amber-400">Aguarda aprovação</span>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Thinking */}
          {loading && (
            <div className="flex gap-3 items-start">
              <div className="shrink-0 w-7 h-7 rounded-lg bg-violet-600/20 ring-1 ring-violet-500/20 flex items-center justify-center mt-0.5">
                <Bot size={13} className="text-violet-400 animate-pulse" />
              </div>
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white/[0.03] ring-1 ring-white/[0.06] rounded-2xl rounded-tl-sm">
                <StepIcon size={12} className="text-violet-400 shrink-0" />
                <span className="text-[12px] text-zinc-500">{STEPS[step].text}</span>
                <span className="flex gap-0.5 ml-0.5">
                  {[0,150,300].map(d => <span key={d} className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} className="h-28" />
        </div>
      )}

      {/* Sticky input */}
      <div className="sticky bottom-0 pb-6 pt-3 bg-gradient-to-t from-[#08080a] via-[#08080a]/90 to-transparent">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white/[0.05] ring-1 ring-white/[0.09] rounded-2xl focus-within:ring-violet-500/30 transition-all overflow-hidden">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px" }}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) } }}
              placeholder="Pergunte sobre suas campanhas..."
              disabled={loading}
              className="w-full px-4 pt-3.5 pb-11 bg-transparent text-[13px] text-white placeholder-zinc-600 focus:outline-none resize-none leading-relaxed disabled:opacity-40"
            />
            <div className="absolute bottom-9 right-4 flex items-center gap-2">
              <span className="text-[10px] text-zinc-700 hidden sm:block">Shift+↵ nova linha</span>
              <button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                className="w-7 h-7 flex items-center justify-center bg-violet-600 hover:bg-violet-500 disabled:opacity-30 rounded-lg transition-colors"
              >
                <Send size={12} className="text-white" />
              </button>
            </div>
          </div>
          <p className="text-center text-[11px] text-zinc-700 mt-2">GTPRO pode cometer erros — verifique decisões importantes.</p>
        </div>
      </div>
    </div>
  )
}
