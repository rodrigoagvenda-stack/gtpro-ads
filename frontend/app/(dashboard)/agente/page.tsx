"use client"

import { useState, useRef, useEffect } from "react"
import { api } from "@/lib/api"
import { Send, Bot, User, History, MessageSquare, CheckCircle, XCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AgentLog } from "@/types"

interface Message {
  role: "user" | "assistant"
  content: string
  actions?: { tool: string; input: Record<string, unknown> }[]
}

const STATUS_CONFIG = {
  success: { icon: CheckCircle, color: "text-emerald-400", label: "Executado" },
  failed: { icon: XCircle, color: "text-red-400", label: "Falhou" },
  pending_approval: { icon: Clock, color: "text-yellow-400", label: "Aguardando aprovação" },
}

export default function AgentePage() {
  const [tab, setTab] = useState<"chat" | "history">("chat")
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Sou o GTPRO, seu agente de tráfego. Posso analisar suas campanhas, identificar problemas e executar otimizações. Como posso ajudar?",
    },
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
    if (tab === "history" && logs.length === 0) {
      setLogsLoading(true)
      api.agent.logs(100).then((data) => {
        setLogs(Array.isArray(data) ? data : [])
        setLogsLoading(false)
      }).catch(() => setLogsLoading(false))
    }
  }, [tab])

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMsg }])
    setLoading(true)

    try {
      const response = await api.agent.query(userMsg)
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.message, actions: response.actions_taken },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Erro ao processar sua mensagem. Tente novamente." },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-3rem)]">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Agente IA</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Converse com o GTPRO em linguagem natural</p>
        </div>
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          <button
            onClick={() => setTab("chat")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors", tab === "chat" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-100")}
          >
            <MessageSquare size={12} /> Chat
          </button>
          <button
            onClick={() => setTab("history")}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors", tab === "history" ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-zinc-100")}
          >
            <History size={12} /> Histórico
          </button>
        </div>
      </div>

      {tab === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {messages.map((msg, i) => (
              <div key={i} className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}>
                {msg.role === "assistant" && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-violet-600/20 flex items-center justify-center">
                    <Bot size={14} className="text-violet-400" />
                  </div>
                )}
                <div className={cn("max-w-[75%] rounded-xl px-4 py-3 text-sm", msg.role === "user" ? "bg-violet-600 text-white" : "bg-zinc-900 border border-zinc-800 text-zinc-200")}>
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-zinc-700 space-y-1">
                      <p className="text-xs text-zinc-500">Ações executadas:</p>
                      {msg.actions.map((a, j) => (
                        <p key={j} className="text-xs text-emerald-400">✓ {a.tool}</p>
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="shrink-0 w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center">
                    <User size={14} className="text-zinc-400" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-3 justify-start">
                <div className="shrink-0 w-7 h-7 rounded-full bg-violet-600/20 flex items-center justify-center">
                  <Bot size={14} className="text-violet-400" />
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="mt-4 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte sobre suas campanhas..."
              className="flex-1 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-4 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 rounded-lg transition-colors"
            >
              <Send size={16} className="text-white" />
            </button>
          </form>
        </>
      )}

      {tab === "history" && (
        <div className="flex-1 overflow-y-auto">
          {logsLoading ? (
            <p className="text-zinc-500 text-sm text-center py-16">Carregando histórico...</p>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500">
              <History size={40} className="text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-400">Nenhuma ação registrada</p>
              <p className="text-xs mt-1">As ações do agente aparecerão aqui.</p>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="divide-y divide-zinc-800">
                {logs.map((log) => {
                  const sc = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.success
                  const Icon = sc.icon
                  return (
                    <div key={log.id} className="px-5 py-3 flex items-start gap-3">
                      <Icon size={14} className={cn("mt-0.5 shrink-0", sc.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-zinc-200 font-medium">{log.action}</p>
                          <span className={cn("text-xs", sc.color)}>{sc.label}</span>
                        </div>
                        {log.params && Object.keys(log.params).length > 0 && (
                          <p className="text-xs text-zinc-500 mt-0.5 truncate">
                            {Object.entries(log.params).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                          </p>
                        )}
                        {log.justification && (
                          <p className="text-xs text-zinc-600 mt-0.5">{log.justification}</p>
                        )}
                      </div>
                      <p className="text-xs text-zinc-600 shrink-0">{new Date(log.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
