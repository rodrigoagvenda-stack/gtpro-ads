"use client"

import { useState, useRef, useEffect } from "react"
import { api } from "@/lib/api"
import { Send, Bot, Search, BarChart2, TrendingUp, Zap, Bell, Power, DollarSign, CheckCircle2, XCircle, Clock, ChevronDown, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface ToolCall { name: string; input: Record<string, any> }
interface Action { tool: string; input: Record<string, any>; result: any }

interface Message {
  role: "user" | "assistant"
  content: string
  tools_used?: ToolCall[]
  actions?: Action[]
}

const TOOL_META: Record<string, { label: string; icon: any; color: string }> = {
  get_campaigns:  { label: "Consultou campanhas",       icon: Search,     color: "text-blue-400 bg-blue-500/10 ring-blue-500/20" },
  get_insights:   { label: "Consultou métricas",        icon: BarChart2,  color: "text-violet-400 bg-violet-500/10 ring-violet-500/20" },
  toggle_campaign:{ label: "Alterou campanha",          icon: Power,      color: "text-amber-400 bg-amber-500/10 ring-amber-500/20" },
  update_budget:  { label: "Atualizou budget",          icon: DollarSign, color: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20" },
  create_alert:   { label: "Criou alerta",              icon: Bell,       color: "text-red-400 bg-red-500/10 ring-red-500/20" },
}

const THINKING_STEPS = [
  { icon: Search,     text: "Consultando campanhas Meta Ads..." },
  { icon: BarChart2,  text: "Analisando métricas de performance..." },
  { icon: TrendingUp, text: "Verificando ROAS e CPL..." },
  { icon: Zap,        text: "Preparando resposta..." },
]

const SUGGESTIONS = [
  "Quais campanhas estão com ROAS abaixo do mínimo?",
  "Analise a performance dos últimos 7 dias",
  "Quais campanhas posso pausar para economizar budget?",
  "Tem alguma campanha com CPL muito alto?",
]

function renderMarkdown(text: string) {
  const lines = text.split("\n")
  const elements: React.ReactNode[] = []
  let key = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (line.startsWith("### ")) {
      elements.push(<p key={key++} className="text-[13px] font-semibold text-white mt-3 mb-1">{line.slice(4)}</p>)
    } else if (line.startsWith("## ")) {
      elements.push(<p key={key++} className="text-[14px] font-semibold text-white mt-4 mb-1">{line.slice(3)}</p>)
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(
        <div key={key++} className="flex items-start gap-2 my-0.5">
          <span className="text-zinc-600 mt-[3px] shrink-0">·</span>
          <span>{inlineMarkdown(line.slice(2))}</span>
        </div>
      )
    } else if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\. /)?.[1]
      elements.push(
        <div key={key++} className="flex items-start gap-2 my-0.5">
          <span className="text-zinc-600 text-[11px] mt-[2px] shrink-0 font-medium">{num}.</span>
          <span>{inlineMarkdown(line.replace(/^\d+\. /, ""))}</span>
        </div>
      )
    } else if (line === "") {
      elements.push(<div key={key++} className="h-2" />)
    } else {
      elements.push(<p key={key++} className="my-0.5">{inlineMarkdown(line)}</p>)
    }
  }
  return elements
}

function inlineMarkdown(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>
    if (part.startsWith("`") && part.endsWith("`")) return <code key={i} className="text-violet-300 bg-violet-500/10 px-1 py-0.5 rounded text-[11px] font-mono">{part.slice(1, -1)}</code>
    return part
  })
}

export default function AgentePage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [thinkStep, setThinkStep] = useState(0)
  const [expandedTools, setExpandedTools] = useState<number[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const thinkInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (loading) {
      thinkInterval.current = setInterval(() => setThinkStep(s => (s + 1) % THINKING_STEPS.length), 1800)
    } else {
      clearInterval(thinkInterval.current)
      setThinkStep(0)
    }
    return () => clearInterval(thinkInterval.current)
  }, [loading])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input) }
  }

  async function send(text: string) {
    if (!text.trim() || loading) return
    setInput("")
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

  const StepIcon = THINKING_STEPS[thinkStep].icon

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 rounded-xl bg-violet-600/20 ring-1 ring-violet-500/30 flex items-center justify-center">
          <Sparkles size={14} className="text-violet-400" />
        </div>
        <div>
          <h1 className="text-[15px] font-semibold text-white">Agente GTPRO</h1>
          <p className="text-[11px] text-zinc-600">claude-sonnet-4-6 · Meta Ads</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-6 pb-4">

        {/* Empty state */}
        {messages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full gap-6 pb-8">
            <div className="w-12 h-12 rounded-2xl bg-violet-600/15 ring-1 ring-violet-500/20 flex items-center justify-center">
              <Sparkles size={20} className="text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-medium text-zinc-200">Como posso ajudar?</p>
              <p className="text-[12px] text-zinc-600 mt-1">Analiso campanhas, identifico problemas e executo otimizações.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-md">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="text-left px-4 py-3 bg-white/[0.03] ring-1 ring-white/[0.07] rounded-xl text-[12px] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200 transition-colors leading-snug">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
            {msg.role === "assistant" && (
              <div className="shrink-0 w-7 h-7 rounded-lg bg-violet-600/20 ring-1 ring-violet-500/20 flex items-center justify-center mt-0.5">
                <Bot size={13} className="text-violet-400" />
              </div>
            )}

            <div className={cn("flex flex-col gap-2", msg.role === "user" ? "items-end max-w-[75%]" : "items-start flex-1")}>

              {/* Tool calls used */}
              {msg.role === "assistant" && msg.tools_used && msg.tools_used.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {msg.tools_used.map((t, j) => {
                    const meta = TOOL_META[t.name] ?? { label: t.name, icon: Zap, color: "text-zinc-400 bg-white/[0.04] ring-white/[0.08]" }
                    const Icon = meta.icon
                    const key = `${i}-${j}`
                    const isOpen = expandedTools.includes(Number(key.replace("-", "")))
                    return (
                      <button
                        key={j}
                        onClick={() => setExpandedTools(p => p.includes(Number(key.replace("-", ""))) ? p.filter(x => x !== Number(key.replace("-", ""))) : [...p, Number(key.replace("-", ""))])}
                        className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 text-[11px] font-medium transition-colors", meta.color)}
                      >
                        <Icon size={10} />
                        {meta.label}
                        {Object.keys(t.input).length > 0 && <ChevronDown size={9} className={cn("transition-transform", isOpen && "rotate-180")} />}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Message bubble */}
              {msg.role === "user" ? (
                <div className="bg-white/[0.07] ring-1 ring-white/[0.09] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[13px] text-zinc-200 leading-relaxed">
                  {msg.content}
                </div>
              ) : (
                <div className="text-[13px] text-zinc-300 leading-relaxed">
                  {renderMarkdown(msg.content)}
                </div>
              )}

              {/* Actions taken */}
              {msg.role === "assistant" && msg.actions && msg.actions.length > 0 && (
                <div className="w-full space-y-1.5 mt-1">
                  {msg.actions.map((a, j) => {
                    const meta = TOOL_META[a.tool] ?? TOOL_META.get_campaigns
                    const Icon = meta.icon
                    const isPending = a.result?.status === "pending_approval"
                    return (
                      <div key={j} className="flex items-center gap-2 px-3 py-2 bg-white/[0.03] ring-1 ring-white/[0.06] rounded-lg">
                        {isPending
                          ? <Clock size={12} className="text-amber-400 shrink-0" />
                          : <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />}
                        <Icon size={11} className={meta.color.split(" ")[0]} />
                        <span className="text-[12px] text-zinc-400">{meta.label}</span>
                        {isPending && <span className="text-[11px] text-amber-400 ml-auto">Aguarda aprovação</span>}
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
          <div className="flex gap-3 justify-start">
            <div className="shrink-0 w-7 h-7 rounded-lg bg-violet-600/20 ring-1 ring-violet-500/20 flex items-center justify-center mt-0.5">
              <Bot size={13} className="text-violet-400 animate-pulse" />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5 px-4 py-2.5 bg-white/[0.03] ring-1 ring-white/[0.06] rounded-2xl rounded-tl-sm">
                <StepIcon size={12} className="text-violet-400 shrink-0" />
                <span className="text-[12px] text-zinc-500">{THINKING_STEPS[thinkStep].text}</span>
                <span className="flex gap-0.5 ml-1">
                  {[0,150,300].map(d => <span key={d} className="w-1 h-1 rounded-full bg-zinc-600 animate-bounce" style={{ animationDelay: `${d}ms` }} />)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="relative mt-3">
        <div className="bg-white/[0.04] ring-1 ring-white/[0.08] rounded-2xl focus-within:ring-violet-500/30 transition-all overflow-hidden">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px" }}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre suas campanhas..."
            disabled={loading}
            className="w-full px-4 pt-3 pb-10 bg-transparent text-[13px] text-white placeholder-zinc-600 focus:outline-none resize-none leading-relaxed disabled:opacity-50"
          />
          <div className="absolute bottom-2.5 right-3 flex items-center gap-2">
            <span className="text-[10px] text-zinc-700">↵ enviar</span>
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="w-7 h-7 flex items-center justify-center bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:hover:bg-violet-600 rounded-lg transition-colors"
            >
              <Send size={12} className="text-white" />
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-zinc-700 mt-2">GTPRO pode cometer erros. Verifique decisões importantes.</p>
      </div>
    </div>
  )
}
