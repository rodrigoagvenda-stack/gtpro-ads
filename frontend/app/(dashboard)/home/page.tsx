"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { api } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { Megaphone, Bell, Users, Bot, AlertTriangle, CheckCircle, ArrowRight, Zap, TrendingUp, TrendingDown, Sparkles, BarChart2, Key, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"

function KpiCard({ label, value, sub, trend }: { label: string; value: string; sub?: string; trend?: "up" | "down" | null }) {
  return (
    <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-5">
      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-3">{label}</p>
      <div className="flex items-end gap-2">
        <p className="text-[24px] font-semibold text-white leading-none tracking-tight">{value}</p>
        {trend && (
          trend === "up"
            ? <TrendingUp size={14} className="text-emerald-400 mb-0.5 shrink-0" />
            : <TrendingDown size={14} className="text-red-400 mb-0.5 shrink-0" />
        )}
      </div>
      {sub && <p className="text-[11px] text-zinc-600 mt-1.5">{sub}</p>}
    </div>
  )
}

function ChecklistItem({ done, label, href }: { done: boolean; label: string; href: string }) {
  return (
    <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] rounded-lg transition-colors group">
      <div className={cn("w-5 h-5 rounded-full flex items-center justify-center shrink-0 ring-1 transition-colors",
        done ? "bg-emerald-500/20 ring-emerald-500/30" : "bg-white/[0.04] ring-white/[0.1] group-hover:ring-violet-500/30"
      )}>
        {done ? <CheckCircle size={11} className="text-emerald-400" /> : <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 group-hover:bg-violet-400 transition-colors" />}
      </div>
      <span className={cn("text-[13px] flex-1", done ? "text-zinc-500 line-through" : "text-zinc-300")}>{label}</span>
      {!done && <ArrowRight size={12} className="text-zinc-600 group-hover:text-zinc-400 transition-colors" />}
    </Link>
  )
}

const ALERT_LABELS: Record<string, string> = {
  roas_baixo: "ROAS Baixo", cpl_alto: "CPL Alto", budget_esgotado: "Budget Esgotado",
  campanha_rejeitada: "Campanha Rejeitada", queda_performance: "Queda de Performance", sem_entrega: "Sem Entrega",
}

export default function HomePage() {
  const router = useRouter()
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [platform, setPlatform] = useState<any>(null)
  const [metaStatus, setMetaStatus] = useState<any>(null)

  useEffect(() => {
    Promise.allSettled([
      api.home.get(),
      api.get("/settings/platform"),
      api.meta.status(),
    ]).then(([home, plat, meta]) => {
      if (home.status === "fulfilled")  setData(home.value)
      if (plat.status === "fulfilled")  setPlatform(plat.value)
      if (meta.status === "fulfilled")  setMetaStatus(meta.value)
      setLoading(false)
    })
  }, [])

  const insights = data?.insights ?? {}
  const spend    = Number(insights.spend ?? 0)
  const roas     = Number(insights.roas ?? 0)
  const ctr      = Number(insights.ctr ?? 0)
  const cpc      = Number(insights.cpc ?? 0)
  const leads    = insights.actions?.find((a: any) => a.action_type === "lead")?.value
  const hour     = new Date().getHours()
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite"

  const hasApiKey    = platform?.anthropic_api_key_set
  const hasMetaConn  = metaStatus?.connected
  const hasCampaigns = (data?.total_campaigns ?? 0) > 0
  const checklistDone = hasApiKey && hasMetaConn && hasCampaigns
  const checklistItems = [
    { done: !!hasApiKey,    label: "Configurar Anthropic API Key",   href: "/configuracoes" },
    { done: !!hasMetaConn,  label: "Conectar conta Meta Ads",        href: "/configuracoes" },
    { done: !!hasCampaigns, label: "Criar ou importar uma campanha", href: "/campanhas" },
  ]

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-white">{greeting} 👋</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5">Visão geral da conta — {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
        </div>
        <button onClick={() => router.push("/agente")} className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-medium rounded-lg transition-colors">
          <Sparkles size={13} /> Perguntar ao agente
        </button>
      </div>

      {!loading && !checklistDone && (
        <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2">
            <Zap size={13} className="text-violet-400" />
            <p className="text-[13px] font-semibold text-white">Primeiros passos</p>
            <span className="ml-auto text-[11px] text-zinc-600">{checklistItems.filter(i => i.done).length}/{checklistItems.length} concluídos</span>
          </div>
          <div className="px-1 pb-2">
            {checklistItems.map(item => <ChecklistItem key={item.label} {...item} />)}
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-5 h-24 animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Gasto este mês" value={formatCurrency(spend)} sub={`${data?.active_campaigns ?? 0} campanhas ativas`} />
          <KpiCard label="ROAS" value={roas ? `${roas.toFixed(2)}x` : "—"} trend={roas >= 2 ? "up" : roas > 0 ? "down" : null} />
          <KpiCard label="CTR" value={ctr ? `${ctr.toFixed(2)}%` : "—"} sub={cpc ? `CPC ${formatCurrency(cpc)}` : undefined} />
          <KpiCard label="Leads (mês)" value={leads ?? "—"} sub="via Meta Ads" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-zinc-500" />
              <span className="text-[13px] font-semibold text-white">Alertas</span>
              {(data?.active_alerts ?? 0) > 0 && <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-500/20 text-red-400 rounded-full">{data.active_alerts}</span>}
            </div>
            <Link href="/alertas" className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">Ver todos <ArrowRight size={10} /></Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {loading ? (
              <div className="px-4 py-8 text-center text-zinc-600 text-[12px]">Carregando...</div>
            ) : (data?.alerts ?? []).length === 0 ? (
              <div className="px-4 py-8 flex flex-col items-center gap-2">
                <CheckCircle size={20} className="text-emerald-500/60" />
                <p className="text-[12px] text-zinc-600">Tudo certo</p>
              </div>
            ) : (
              (data.alerts as any[]).map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <AlertTriangle size={12} className="text-amber-400 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[12px] font-medium text-zinc-300">{ALERT_LABELS[a.type] ?? a.type}</p>
                    <p className="text-[11px] text-zinc-600 truncate mt-0.5">{a.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Megaphone size={13} className="text-zinc-500" />
              <span className="text-[13px] font-semibold text-white">Campanhas</span>
            </div>
            <Link href="/campanhas" className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">Ver todas <ArrowRight size={10} /></Link>
          </div>
          <div className="divide-y divide-white/[0.04]">
            {loading ? (
              <div className="px-4 py-8 text-center text-zinc-600 text-[12px]">Carregando...</div>
            ) : (data?.top_campaigns ?? []).length === 0 ? (
              <div className="px-4 py-8 flex flex-col items-center gap-2">
                <Megaphone size={20} className="text-zinc-700" />
                <p className="text-[12px] text-zinc-600">Nenhuma campanha</p>
                <Link href="/campanhas" className="text-[12px] text-violet-400 hover:text-violet-300 transition-colors">Conectar Meta Ads →</Link>
              </div>
            ) : (
              (data.top_campaigns as any[]).map((c: any) => (
                <div key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", c.status === "ACTIVE" ? "bg-emerald-400" : "bg-zinc-600")} />
                  <p className="text-[12px] text-zinc-300 truncate flex-1">{c.name}</p>
                  <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0", c.status === "ACTIVE" ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-600 bg-white/[0.04]")}>{c.status === "ACTIVE" ? "Ativa" : "Pausada"}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={13} className="text-zinc-500" />
                <span className="text-[13px] font-semibold text-white">Leads recentes</span>
              </div>
              <Link href="/rastreamento" className="text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors flex items-center gap-1">Ver todos <ArrowRight size={10} /></Link>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {loading ? (
                <div className="px-4 py-5 text-center text-zinc-600 text-[12px]">Carregando...</div>
              ) : (data?.leads ?? []).length === 0 ? (
                <div className="px-4 py-5 text-center text-zinc-600 text-[12px]">Nenhum lead ainda</div>
              ) : (
                (data.leads as any[]).map((l: any) => (
                  <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="w-6 h-6 rounded-full bg-violet-500/15 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold text-violet-400">{(l.name ?? "?")[0].toUpperCase()}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-zinc-300 truncate">{l.name ?? "Lead"}</p>
                      <p className="text-[10px] text-zinc-600 truncate">{l.utm_campaign ?? "Sem campanha"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
            <div className="px-4 py-3.5 border-b border-white/[0.05] flex items-center gap-2">
              <Bot size={13} className="text-zinc-500" />
              <span className="text-[13px] font-semibold text-white">Agente — últimas ações</span>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {loading ? (
                <div className="px-4 py-5 text-center text-zinc-600 text-[12px]">Carregando...</div>
              ) : (data?.agent_logs ?? []).length === 0 ? (
                <div className="px-4 py-5 text-center text-zinc-600 text-[12px]">Nenhuma ação ainda</div>
              ) : (
                (data.agent_logs as any[]).map((l: any) => (
                  <div key={l.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0 mt-0.5", l.status === "success" ? "bg-emerald-400" : "bg-amber-400")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] text-zinc-400 truncate font-mono">{l.action}</p>
                      <p className="text-[10px] text-zinc-600">{new Date(l.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
