"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import KpiCard from "@/components/dashboard/KpiCard"
import CampaignRow from "@/components/dashboard/CampaignRow"
import type { Campaign } from "@/types"
import { cn } from "@/lib/utils"
import { AlertTriangle, RefreshCw, Key, Calendar, Link2, ArrowRight } from "lucide-react"

function isTokenExpired(msg: string) {
  return msg.includes("190") || msg.includes("463") || msg.includes("Session has expired") || msg.includes("access token")
}
function isNotConnected(msg: string) {
  return msg.toLowerCase().includes("não conectada") || msg.toLowerCase().includes("not connected") || msg.toLowerCase().includes("no active") || msg.toLowerCase().includes("sem conta")
}

const PRESETS = [
  { value: "today",      label: "Hoje" },
  { value: "last_7d",    label: "7 dias" },
  { value: "last_30d",   label: "30 dias" },
  { value: "this_month", label: "Este mês" },
  { value: "custom",     label: "Personalizado" },
]

const KPI_OBJECTIVES = [
  { id: "geral",       label: "Geral" },
  { id: "ecommerce",   label: "E-commerce" },
  { id: "leads",       label: "Leads" },
  { id: "whatsapp",    label: "WhatsApp" },
  { id: "engajamento", label: "Engajamento" },
  { id: "trafego",     label: "Tráfego" },
  { id: "seguidores",  label: "Seguidores" },
]

export default function CampanhasPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 6
  const [insights, setInsights] = useState<Record<string, any>>({})
  const [preset, setPreset] = useState("last_7d")
  const [since, setSince] = useState("")
  const [until, setUntil] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [kpiPreset, setKpiPreset] = useState("geral")
  const [refreshKey, setRefreshKey] = useState(0)

  const isCustom = preset === "custom"
  const customReady = isCustom && since && until && since <= until

  useEffect(() => {
    if (isCustom && !customReady) return
    setLoading(true)
    setError(null)
    const insightsCall = isCustom
      ? api.insights.get("last_7d", since, until)
      : api.insights.get(preset)
    Promise.all([api.campaigns.list(preset), insightsCall])
      .then(([c, i]) => {
        setCampaigns(Array.isArray(c) ? c : [])
        setPage(1)
        setInsights(i && typeof i === "object" && !Array.isArray(i) ? i : {})
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || "Erro ao carregar dados")
        setLoading(false)
      })
  }, [preset, customReady ? since : null, customReady ? until : null, refreshKey])

  async function toggleCampaign(id: string, status: string) {
    const next = status === "ACTIVE" ? "PAUSED" : "ACTIVE"
    await api.campaigns.toggle(id, next)
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, status: next as Campaign["status"] } : c))
  }

  const totalSpend = campaigns.reduce((a, c) => a + (c.metrics?.spend || 0), 0)

  const impressions = Number(insights.impressions ?? 0)
  const reach = Number(insights.reach ?? 0)
  const clicks = Number(insights.clicks ?? 0)
  const leads = insights.actions?.find((a: any) => a.action_type === "lead")?.value
  const purchases = insights.actions?.find((a: any) => a.action_type === "purchase")?.value

  const funnelSteps = [
    { label: "Impressões", value: impressions },
    ...(reach > 0 ? [{ label: "Alcance", value: reach }] : []),
    { label: "Cliques", value: clicks },
    ...(leads ? [{ label: "Leads", value: Number(leads) }] : []),
    ...(purchases ? [{ label: "Compras", value: Number(purchases) }] : []),
  ].filter((s) => s.value > 0)

  const maxVal = funnelSteps[0]?.value || 1

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-white">Campanhas</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5">Performance da conta Meta Ads</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex items-center bg-white/[0.04] rounded-lg p-0.5 ring-1 ring-white/[0.06]">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors flex items-center gap-1.5",
                  preset === p.value ? "bg-white/[0.08] text-white" : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                {p.value === "custom" && <Calendar size={11} />}
                {p.label}
              </button>
            ))}
          </div>

          {isCustom && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={since}
                onChange={e => setSince(e.target.value)}
                className="bg-white/[0.04] ring-1 ring-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-white focus:outline-none focus:ring-violet-500/50 [color-scheme:dark]"
              />
              <span className="text-zinc-600 text-[12px]">até</span>
              <input
                type="date"
                value={until}
                onChange={e => setUntil(e.target.value)}
                min={since}
                className="bg-white/[0.04] ring-1 ring-white/[0.06] rounded-lg px-3 py-1.5 text-[12px] text-white focus:outline-none focus:ring-violet-500/50 [color-scheme:dark]"
              />
            </div>
          )}
        </div>
      </div>

      {/* KPI Objective filter */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {KPI_OBJECTIVES.map((o) => (
          <button
            key={o.id}
            onClick={() => setKpiPreset(o.id)}
            className={cn(
              "px-3 py-1 rounded-full text-[11px] font-medium transition-colors",
              kpiPreset === o.id
                ? "bg-violet-600 text-white"
                : "bg-white/[0.04] text-zinc-500 hover:text-zinc-300 ring-1 ring-white/[0.06]"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      {kpiPreset === "geral" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Gasto total" value={formatCurrency(insights.spend || totalSpend)} highlight />
          <KpiCard label="ROAS" value={insights.roas ? `${Number(insights.roas).toFixed(2)}x` : "—"} />
          <KpiCard label="CPC" value={insights.cpc ? formatCurrency(Number(insights.cpc)) : "—"} />
          <KpiCard label="CTR" value={insights.ctr ? `${Number(insights.ctr).toFixed(2)}%` : "—"} />
        </div>
      )}
      {kpiPreset === "ecommerce" && (() => {
        const purchaseVal = insights.actions?.find((a: any) => a.action_type === "purchase")?.value
        const purchaseRev = insights.action_values?.find((a: any) => a.action_type === "purchase")?.value
        const numPurchases = purchaseVal ? Number(purchaseVal) : 0
        const revenue = purchaseRev ? Number(purchaseRev) : 0
        const spend = Number(insights.spend || totalSpend)
        const cpa = numPurchases > 0 ? spend / numPurchases : 0
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Gasto total" value={formatCurrency(spend)} highlight />
            <KpiCard label="ROAS" value={insights.roas ? `${Number(insights.roas).toFixed(2)}x` : "—"} />
            <KpiCard label="Receita" value={revenue > 0 ? formatCurrency(revenue) : "—"} />
            <KpiCard label="CPA" value={cpa > 0 ? formatCurrency(cpa) : "—"} />
          </div>
        )
      })()}
      {kpiPreset === "leads" && (() => {
        const leadsVal = insights.actions?.find((a: any) => a.action_type === "lead")?.value
        const numLeads = leadsVal ? Number(leadsVal) : 0
        const spend = Number(insights.spend || totalSpend)
        const cpl = numLeads > 0 ? spend / numLeads : 0
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Gasto total" value={formatCurrency(spend)} highlight />
            <KpiCard label="Leads" value={numLeads > 0 ? numLeads.toLocaleString("pt-BR") : "—"} />
            <KpiCard label="CPL" value={cpl > 0 ? formatCurrency(cpl) : "—"} />
            <KpiCard label="CTR" value={insights.ctr ? `${Number(insights.ctr).toFixed(2)}%` : "—"} />
          </div>
        )
      })()}
      {kpiPreset === "whatsapp" && (() => {
        const msgVal = insights.actions?.find((a: any) =>
          a.action_type === "onsite_conversion.messaging_conversation_started_7d" ||
          a.action_type === "onsite_conversion.total_messaging_connection"
        )?.value
        const numMsg = msgVal ? Number(msgVal) : 0
        const spend = Number(insights.spend || totalSpend)
        const cpm = numMsg > 0 ? spend / numMsg : 0
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Gasto total" value={formatCurrency(spend)} highlight />
            <KpiCard label="Conversas" value={numMsg > 0 ? numMsg.toLocaleString("pt-BR") : "—"} />
            <KpiCard label="Custo/conversa" value={cpm > 0 ? formatCurrency(cpm) : "—"} />
            <KpiCard label="Cliques" value={clicks > 0 ? clicks.toLocaleString("pt-BR") : "—"} />
          </div>
        )
      })()}
      {kpiPreset === "engajamento" && (() => {
        const engVal = insights.actions?.find((a: any) => a.action_type === "post_engagement")?.value
        const numEng = engVal ? Number(engVal) : 0
        const spend = Number(insights.spend || totalSpend)
        const cpe = numEng > 0 ? spend / numEng : 0
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Gasto total" value={formatCurrency(spend)} highlight />
            <KpiCard label="Alcance" value={reach > 0 ? `${(reach/1000).toFixed(1)}k` : "—"} />
            <KpiCard label="Engajamentos" value={numEng > 0 ? numEng.toLocaleString("pt-BR") : "—"} />
            <KpiCard label="Custo/eng." value={cpe > 0 ? formatCurrency(cpe) : "—"} />
          </div>
        )
      })()}
      {kpiPreset === "trafego" && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard label="Gasto total" value={formatCurrency(insights.spend || totalSpend)} highlight />
          <KpiCard label="Cliques" value={clicks > 0 ? clicks.toLocaleString("pt-BR") : "—"} />
          <KpiCard label="CPC" value={insights.cpc ? formatCurrency(Number(insights.cpc)) : "—"} />
          <KpiCard label="CTR" value={insights.ctr ? `${Number(insights.ctr).toFixed(2)}%` : "—"} />
        </div>
      )}
      {kpiPreset === "seguidores" && (() => {
        const followVal = insights.actions?.find((a: any) => a.action_type === "like")?.value
        const numFollow = followVal ? Number(followVal) : 0
        const spend = Number(insights.spend || totalSpend)
        const cpf = numFollow > 0 ? spend / numFollow : 0
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard label="Gasto total" value={formatCurrency(spend)} highlight />
            <KpiCard label="Alcance" value={reach > 0 ? `${(reach/1000).toFixed(1)}k` : "—"} />
            <KpiCard label="Seguidores/Curtidas" value={numFollow > 0 ? numFollow.toLocaleString("pt-BR") : "—"} />
            <KpiCard label="Custo/seguidor" value={cpf > 0 ? formatCurrency(cpf) : "—"} />
          </div>
        )
      })()}

      {/* Funnel */}
      {funnelSteps.length >= 3 && (
        <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-5">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-5">Funil da conta</p>
          <div className="flex items-end gap-2 h-20">
            {funnelSteps.map((step, i) => {
              const h = Math.max(8, (step.value / maxVal) * 80)
              const conv = i > 0 && funnelSteps[i - 1].value > 0
                ? ((step.value / funnelSteps[i - 1].value) * 100).toFixed(1)
                : null
              return (
                <div key={step.label} className="flex-1 flex flex-col items-center gap-1">
                  <p className="text-[10px] text-zinc-400 font-medium">
                    {step.value >= 1000 ? `${(step.value / 1000).toFixed(1)}k` : step.value}
                  </p>
                  {conv && (
                    <p className={cn("text-[10px]", Number(conv) >= 2 ? "text-emerald-500" : "text-zinc-500")}>
                      {conv}%
                    </p>
                  )}
                  <div className="w-full flex flex-col justify-end" style={{ height: 56 }}>
                    <div
                      className={cn("w-full rounded-sm", i === 0 ? "bg-violet-600/60" : "bg-violet-600/30")}
                      style={{ height: h }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-600 text-center leading-tight">{step.label}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-white/[0.05] flex items-center justify-between">
          <p className="text-[12px] font-medium text-zinc-400">
            {campaigns.length} campanha{campaigns.length !== 1 ? "s" : ""}
          </p>
          <div className="hidden md:flex gap-5 pr-14 text-[11px] text-zinc-600 uppercase tracking-wider">
            <span>Gasto</span>
            <span>ROAS</span>
            <span>CPL</span>
            <span>CTR</span>
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-14 text-center text-[13px] text-zinc-600">Carregando...</div>
        ) : error ? (
          <div className="px-5 py-12 flex flex-col items-center gap-4 text-center">
            <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle size={18} className="text-amber-400" />
            </div>
            {isNotConnected(error) ? (
              <>
                <div>
                  <p className="text-[14px] font-medium text-white mb-1">Conta Meta Ads não conectada</p>
                  <p className="text-[12px] text-zinc-500 max-w-sm leading-relaxed">
                    Para visualizar campanhas, você precisa conectar sua conta de anúncios do Meta Ads.<br /><br />
                    Vá em <strong className="text-zinc-300">Configurações → Meta Ads</strong> e clique em <strong className="text-zinc-300">Conectar via OAuth</strong> ou insira um System User Token permanente.
                  </p>
                </div>
                <button onClick={() => router.push("/configuracoes?tab=meta")} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-medium rounded-lg transition-colors">
                  <Link2 size={12} /> Conectar Meta Ads <ArrowRight size={12} />
                </button>
              </>
            ) : isTokenExpired(error) ? (
              <>
                <div>
                  <p className="text-[14px] font-medium text-white mb-1">Token Meta Ads expirado</p>
                  <p className="text-[12px] text-zinc-500 max-w-xs">
                    O token de acesso expirou. Tokens OAuth do Meta duram ~60 dias. Para não ter esse problema novamente, use um <strong className="text-zinc-300">System User Token permanente</strong>.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => router.push("/configuracoes?tab=meta")} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-medium rounded-lg transition-colors">
                    <RefreshCw size={12} /> Reconectar via OAuth
                  </button>
                  <button onClick={() => router.push("/configuracoes?tab=meta")} className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.09] text-zinc-300 text-[12px] font-medium rounded-lg ring-1 ring-white/[0.08] transition-colors">
                    <Key size={12} /> Usar token permanente
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[13px] text-red-400">Erro ao carregar campanhas</p>
                <p className="text-[11px] text-zinc-600 max-w-sm">{error}</p>
              </>
            )}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="px-5 py-14 text-center text-[13px] text-zinc-600">Nenhuma campanha encontrada.</div>
        ) : (() => {
          const pageCount = Math.ceil(campaigns.length / PAGE_SIZE)
          const paginated = campaigns.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
          return (
            <>
              <div className="divide-y divide-white/[0.04]">
                {paginated.map((c) => (
                  <CampaignRow key={c.id} campaign={c} onToggle={() => toggleCampaign(c.id, c.status)} />
                ))}
              </div>
              {pageCount > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-white/[0.05]">
                  <p className="text-[12px] text-zinc-600">{campaigns.length} campanhas · página {page} de {pageCount}</p>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1.5 text-[12px] text-zinc-500 hover:text-zinc-200 disabled:opacity-30 hover:bg-white/[0.04] rounded-lg transition-colors">
                      ← Anterior
                    </button>
                    {Array.from({ length: pageCount }, (_, i) => i + 1).map(n => (
                      <button key={n} onClick={() => setPage(n)}
                        className={cn("w-7 h-7 text-[12px] rounded-lg transition-colors", n === page ? "bg-white/[0.08] text-white" : "text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]")}>
                        {n}
                      </button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page === pageCount}
                      className="px-3 py-1.5 text-[12px] text-zinc-500 hover:text-zinc-200 disabled:opacity-30 hover:bg-white/[0.04] rounded-lg transition-colors">
                      Próxima →
                    </button>
                  </div>
                </div>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
