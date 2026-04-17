"use client"

import { useState, useRef, useEffect } from "react"
import { api } from "@/lib/api"
import { Send, Bot, User } from "lucide-react"
import { cn } from "@/lib/utils"

interface Message {
  role: "user" | "assistant"
  content: string
  actions?: { tool: string; input: Record<string, unknown> }[]
}

export default function AgentePage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Olá! Sou o GTPRO, seu agente de tráfego. Posso analisar suas campanhas, identificar problemas e executar otimizações. Como posso ajudar?",
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
        {
          role: "assistant",
          content: response.message,
          actions: response.actions_taken,
        },
      ])
    } catch (err) {
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
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-white">Agente IA</h1>
        <p className="text-xs text-zinc-500 mt-0.5">Converse com o GTPRO em linguagem natural</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn("flex gap-3", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            {msg.role === "assistant" && (
              <div className="shrink-0 w-7 h-7 rounded-full bg-violet-600/20 flex items-center justify-center">
                <Bot size={14} className="text-violet-400" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[75%] rounded-xl px-4 py-3 text-sm",
                msg.role === "user"
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-900 border border-zinc-800 text-zinc-200"
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-700 space-y-1">
                  <p className="text-xs text-zinc-500">Ações executadas:</p>
                  {msg.actions.map((a, j) => (
                    <p key={j} className="text-xs text-emerald-400">
                      ✓ {a.tool}
                    </p>
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
    </div>
  )
}
