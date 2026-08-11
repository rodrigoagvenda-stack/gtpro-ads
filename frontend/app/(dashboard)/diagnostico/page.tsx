"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import {
  HeartPulse, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Wifi, WifiOff, Activity, DollarSign, Bell, Bot, Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DiagResult {
  meta_connection:    { status: string; ad_account_id?: string; updated_at?: string }
  google_connection:  { status: string; customer_id?: string; customer_name?: string; updated_at?: string }
  pixels:             { id: string; name: string; events_7d: number; status: string }[]
  account:            { currency: string; spend_cap?: number; amount_spent?: number; status?: number } | null
  config:             { budget_mensal?: number; roas_minimo?: number; cpl_maximo?: number }
  active_alerts:      number
  agent_actions_24h:  number
}

function StatusIcon({ status }: { status: "ok" | "warn" | "error" | "off" }) {
  if (status === "ok")   return <CheckCircle2 size={16} className="text-emerald-400" />
  if (status === "warn") return <AlertTriangle size={16} className="text-amber-400" />
  if (status === "off")  return <WifiOff size={16} className="text-zinc-600" />
  return <XCircle size={16} className="text-red-400" />
}

function Card({ title, icon: Icon, status, children }: {
  title: string; icon: any; status: "ok" | "warn" | "error" | "off"; children: React.ReactNode
}) {
  const ring = status === "ok" ? "ring-emerald-500/15" : status === "warn" ? "ring-amber-500/15" : status === "off" ? "ring-white/[0.06]" : "ring-red-500/15"
  return (
    <div className={cn("bg-zinc-900/60 ring-1 rounded-2xl p-5 flex flex-col gap-4", ring)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/[0.04] ring-1 ring-white/[0.07] flex items-center justify-center">
            <Icon size={15} className="text-zinc-400" />
          </div>
          <span className="text-[14px] font-semibold text-zinc-100">{title}</span>
        </div>
        <StatusIcon status={status} />
      </div>
      <div className="text-[13px] text-zinc-500 space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-600">{label}</span>
      <span className={cn("font-medium text-right", ok === true ? "text-emerald-400" : ok === false ? "text-red-400" : "text-zinc-300")}>
        {value}
      </span>
    </div>
  )
}

export default function DiagnosticoPage() {
  const [data, setData]       = useState<DiagResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  async function load() {
    setLoading(true); setError(null)
    try {
      const d = await api.get("/diagnostico")
      setData(d)
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex gap-1">
        {[0, 120, 240].map(d => (
          <span key={d} className="w-2 h-2 rounded-full bg-violet-500/40 animate-bounce"
            style={{ animationDelay: `${d}ms`, animationDuration: "1.2s" }} />
        ))}
      </div>
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center h-64 text-red-400 text-[14px]">{error}</div>
  )

  if (!data) return null

  const metaOk   = data.meta_connection.status === "connected"
  const googleOk = data.google_connection.status === "connected"
  const pixelsFiring = data.pixels.filter(p => p.status === "firing").length
  const pixelsTotal  = data.pixels.length
  const pixelStatus: "ok" | "warn" | "error" | "off" =
    pixelsTotal === 0 ? "off" :
    pixelsFiring === pixelsTotal ? "ok" :
    pixelsFiring > 0 ? "warn" : "error"

  const budgetMensal  = data.config.budget_mensal ?? 0
  const amountSpent   = data.account?.amount_spent ? data.account.amount_spent / 100 : null
  const budgetPct     = budgetMensal > 0 && amountSpent !== null ? amountSpent / budgetMensal : null
  const budgetStatus: "ok" | "warn" | "error" | "off" =
    budgetPct === null ? "off" :
    budgetPct >= 1   ? "error" :
    budgetPct >= 0.9 ? "warn" : "ok"

  const alertStatus: "ok" | "warn" | "error" | "off" =
    data.active_alerts === 0 ? "ok" :
    data.active_alerts <= 3  ? "warn" : "error"

  return (
    <div className="space-y-7 max-w-[900px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-white tracking-tight flex items-center gap-2.5">
            <HeartPulse size={22} className="text-violet-400" />
            Diagnóstico da Conta
          </h1>
          <p className="text-[13px] text-zinc-500 mt-1">Visão geral da saúde das integrações e métricas</p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] text-zinc-500 hover:text-zinc-200 ring-1 ring-white/[0.07] hover:bg-white/[0.05] transition-all disabled:opacity-40">
          <RefreshCw size={12} className={cn(loading && "animate-spin")} />
          Atualizar
        </button>
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        {/* Meta Ads */}
        <Card title="Meta Ads" icon={Wifi} status={metaOk ? "ok" : "error"}>
          <Row label="Status" value={metaOk ? "Conectado" : "Desconectado"} ok={metaOk} />
          {data.meta_connection.ad_account_id && (
            <Row label="Conta" value={`act_${data.meta_connection.ad_account_id}`} />
          )}
          {!metaOk && (
            <p className="text-[12px] text-red-400/80 mt-1">Reconecte em Configurações → Meta Ads</p>
          )}
        </Card>

        {/* Google Ads */}
        <Card title="Google Ads" icon={Activity} status={googleOk ? "ok" : "off"}>
          <Row label="Status" value={googleOk ? "Conectado" : "Não conectado"} ok={googleOk || undefined} />
          {data.google_connection.customer_name && (
            <Row label="Conta" value={data.google_connection.customer_name} />
          )}
          {!googleOk && (
            <p className="text-[12px] text-zinc-600 mt-1">Configure em Configurações → Google Ads</p>
          )}
        </Card>

        {/* Pixels */}
        <Card title="Pixels" icon={Zap} status={pixelStatus}>
          {pixelsTotal === 0
            ? <p className="text-zinc-600">Nenhum pixel encontrado na conta</p>
            : data.pixels.map(px => (
              <div key={px.id} className="flex items-center justify-between gap-2">
                <span className="truncate text-zinc-400">{px.name}</span>
                <span className={cn("text-[12px] font-medium shrink-0", px.status === "firing" ? "text-emerald-400" : "text-red-400")}>
                  {px.status === "firing" ? `${px.events_7d.toLocaleString("pt-BR")} eventos` : "Sem eventos"}
                </span>
              </div>
            ))
          }
        </Card>

        {/* Budget Mensal */}
        <Card title="Budget Mensal" icon={DollarSign} status={budgetStatus}>
          {budgetMensal === 0
            ? <p className="text-zinc-600">Não configurado — defina em Configurações → Agente</p>
            : <>
              <Row label="Budget" value={`R$ ${budgetMensal.toLocaleString("pt-BR")}`} />
              {amountSpent !== null && (
                <>
                  <Row label="Gasto este mês" value={`R$ ${amountSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} ok={budgetPct! < 0.9} />
                  <div className="mt-1">
                    <div className="flex justify-between text-[11px] text-zinc-600 mb-1">
                      <span>Consumido</span>
                      <span>{Math.round((budgetPct ?? 0) * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", budgetPct! >= 1 ? "bg-red-500" : budgetPct! >= 0.9 ? "bg-amber-500" : "bg-emerald-500")}
                        style={{ width: `${Math.min(100, (budgetPct ?? 0) * 100)}%` }} />
                    </div>
                  </div>
                </>
              )}
            </>
          }
        </Card>

        {/* Alertas */}
        <Card title="Alertas Ativos" icon={Bell} status={alertStatus}>
          <Row label="Total de alertas" value={String(data.active_alerts)} ok={data.active_alerts === 0} />
          {data.active_alerts > 0 && (
            <a href="/alertas" className="text-[12px] text-violet-400 hover:text-violet-300 transition-colors mt-1 inline-block">
              Ver alertas
            </a>
          )}
          {data.active_alerts === 0 && (
            <p className="text-emerald-500/70 text-[12px]">Nenhum problema detectado</p>
          )}
        </Card>

        {/* Agente */}
        <Card title="Agente IA" icon={Bot} status={data.agent_actions_24h > 0 ? "ok" : "off"}>
          <Row label="Ações últimas 24h" value={String(data.agent_actions_24h)} ok={data.agent_actions_24h > 0 || undefined} />
          {data.config.roas_minimo !== undefined && (
            <Row label="ROAS mínimo" value={`${data.config.roas_minimo}x`} />
          )}
          {data.config.cpl_maximo !== undefined && (
            <Row label="CPL máximo" value={`R$ ${data.config.cpl_maximo}`} />
          )}
        </Card>
      </div>

      {/* Quick tips */}
      {(!metaOk || pixelStatus === "error" || budgetStatus === "error") && (
        <div className="bg-amber-500/5 ring-1 ring-amber-500/15 rounded-2xl p-5 space-y-3">
          <p className="text-[13px] font-semibold text-amber-400 flex items-center gap-2">
            <AlertTriangle size={14} /> Atenção necessária
          </p>
          <ul className="space-y-2 text-[13px] text-zinc-400">
            {!metaOk && <li>Conta Meta desconectada — verifique o token em Configurações → Meta Ads</li>}
            {pixelStatus === "error" && <li>Pixel sem eventos nos últimos 7 dias — verifique a instalação no site</li>}
            {budgetStatus === "error" && <li>Budget mensal esgotado — pausar campanhas ou aumentar o limite</li>}
          </ul>
        </div>
      )}
    </div>
  )
}
