"use client"

import { useState, useRef, useEffect } from "react"
import { api } from "@/lib/api"
import { Send, Bot, User, History, MessageSquare, CheckCircle2, XCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentLog } from "@/types"

interface Message {
  role: "user" | "assistant"
  content: string
  actions?: { tool: string; input: Record<string, unknown> }[]
}

const STATUS_CFG = {
  success: { icon: CheckCircle2, color: "text-emerald-500", label: "Executado" },
  failed: { icon: XCircle, color: "text-red-400", label: "Falhou" },
  pending_approval: { icon: Clock, color: "text-amber-400", label: "Aguardando aprovação" },
}

const SUGGESTIONS = [
  "Quais campanhas estão com ROAS abaixo do mínimo?",
  "Analise a performance dos últimos 7 dias",
  "Quais campanhas posso pausar para economizar budget?",
]

export default function AgentePage() {
  const [tab, setTab] = useState<"chat" | "history">("chat")
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá! Sou o GTPRO. Posso analisar suas campanhas, identificar problemas e executar otimizações. Como posso ajudar?" },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const [logs, setLogs] = useState<AgentLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (tab === "history" && !logs.length) {
      setLogsLoading(true)
      api.agent.logs(100).then((d) => {
        setLogs(Array.isArray(d) ? d : [])
        setLogsLoading(false)
      }).catch(() => setLogsLoading(false))
    }
  }, [tab])

  async function send(text: string) {
    if (!text.trim() || loading) return
    setInput("")
    setMessages((p) => [...p, { role: "user", content: text }])
    setLoading(true)
    try {
      const res = await api.agent.query(text)
      setMessages((p) => [...p, { role: "assistant", content: res.message, actions: res.actions_taken }])
    } catch {
      setMessages((p) => [...p, { role: "assistant", content: "Erro ao processar. Tente novamente." }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px-56px)]">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[17px] font-semibold text-white">Agente IA</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5">GTPRO — modelo claude-sonnet-4-6</p>
        </div>
        <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 ring-1 ring-white/[0.06]">
          {([["chat", MessageSquare, "Chat"], ["history", History, "Histórico"]] as const).map(([t, Icon, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                tab === t ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Icon size={12} />{label}
            </button>
          ))}
        </div>
      </div>

      {tab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto space-y-4 pb-2">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-2.5", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="shrink-0 w-6 h-6 rounded-md bg-violet-600/20 flex items-center justify-center mt-0.5">
                    <Bot size={12} className="text-violet-400" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[70%] rounded-xl px-4 py-3 text-[13px]",
                  msg.role === "user"
                    ? "bg-violet-600 text-white"
                    : "bg-white/[0.04] ring-1 ring-white/[0.07] text-zinc-200"
                )}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2.5 pt-2.5 border-t border-white/10 space-y-1">
                      <p className="text-[11px] text-zinc-500">Ações executadas:</p>
                      {msg.actions.map((a, j) => (
                        <p key={j} className="text-[11px] text-emerald-400">✓ {a.tool}</p>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="shrink-0 w-6 h-6 rounded-md bg-white/[0.06] flex items-center justify-center mt-0.5">
                    <User size={12} className="text-zinc-400" />
                  </div>
                )}
              </div>
            ))}

            {/* Suggestions — only on first message */}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="px-3 py-1.5 text-[12px] text-zinc-400 bg-white/[0.04] ring-1 ring-white/[0.07] rounded-lg hover:bg-white/[0.07] hover:text-zinc-200 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {loading && (
              <div className="flex gap-2.5 justify-start">
                <div className="shrink-0 w-6 h-6 rounded-md bg-violet-600/20 flex items-center justify-center mt-0.5">
                  <Bot size={12} className="text-violet-400" />
                </div>
                <div className="bg-white/[0.04] ring-1 ring-white/[0.07] rounded-xl px-4 py-3">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(input) }} className="mt-3 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre suas campanhas..."
              className="flex-1 px-4 py-2.5 bg-white/[0.04] ring-1 ring-white/[0.07] rounded-lg text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/40 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-3.5 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-lg transition-colors"
            >
              <Send size={14} className="text-white" />
            </button>
          </form>
        </>
      )}

      {tab === "history" && (
        <div className="flex-1 overflow-y-auto">
          {logsLoading ? (
            <p className="text-center py-16 text-[13px] text-zinc-600">Carregando...</p>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <div className="w-9 h-9 rounded-full bg-white/[0.04] flex items-center justify-center">
                <History size={16} className="text-zinc-600" />
              </div>
              <div className="text-center">
                <p className="text-[13px] text-zinc-400">Sem ações registradas</p>
                <p className="text-[12px] text-zinc-600 mt-0.5">As ações do agente aparecerão aqui.</p>
              </div>
            </div>
          ) : (
            <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden divide-y divide-white/[0.04]">
              {logs.map((log) => {
                const sc = STATUS_CFG[log.status] ?? STATUS_CFG.success
                const Icon = sc.icon
                return (
                  <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                    <Icon size={13} className={cn("mt-0.5 shrink-0", sc.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] text-zinc-200 font-medium">{log.action}</p>
                        <span className={cn("text-[11px]", sc.color)}>{sc.label}</span>
                      </div>
                      {log.params && Object.keys(log.params).length > 0 && (
                        <p className="text-[11px] text-zinc-600 mt-0.5 truncate">
                          {Object.entries(log.params).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                        </p>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-700 shrink-0">
                      {new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
