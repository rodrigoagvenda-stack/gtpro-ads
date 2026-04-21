"use client"

import { useState, useCallback, useEffect } from "react"
import { Copy, Check, Link2, ChevronDown, RefreshCw, Users, Key, RotateCcw, ExternalLink, TrendingUp } from "lucide-react"
import { api } from "@/lib/api"

// ─── shared helpers ────────────────────────────────────────────────────────────

const SOURCES = [
  { value: "facebook", label: "Facebook" },
  { value: "instagram", label: "Instagram" },
  { value: "meta", label: "Meta (genérico)" },
]

const MEDIUMS = [
  { value: "paid_social", label: "paid_social" },
  { value: "cpc", label: "cpc" },
  { value: "cpm", label: "cpm" },
  { value: "social", label: "social" },
]

const DATE_PRESETS = [
  { value: "today",    label: "Hoje" },
  { value: "last_7d",  label: "7 dias" },
  { value: "last_30d", label: "30 dias" },
  { value: "last_90d", label: "90 dias" },
]

const PREVIEW_SUBS: Record<string, string> = {
  "{{campaign.name}}": "Conversão_Leads_Q2",
  "{{adset.name}}":    "Homens_25-44_SP",
  "{{ad.name}}":       "Criativo_VideoA",
  "{{placement}}":     "feed",
  "{{fbclid}}":        "IwAR2abc123xyz",
}

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])
  return { copied, copy }
}

function CopyBtn({ text, size = "sm" }: { text: string; size?: "sm" | "xs" }) {
  const { copied, copy } = useCopy(text)
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.1] transition-colors text-zinc-300 shrink-0 ${size === "xs" ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]"}`}
    >
      {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  )
}

function SelectField({ label, value, options, onChange }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white pr-8 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
        >
          {options.map(o => <option key={o.value} value={o.value} className="bg-[#0b0b0d]">{o.label}</option>)}
        </select>
        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
      </div>
    </div>
  )
}

function CodeBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        <CopyBtn text={value} />
      </div>
      <div className="bg-[#0d0d10] border border-white/[0.07] rounded-lg p-3.5 font-mono text-[12px] text-violet-300 break-all leading-relaxed">
        {value}
      </div>
    </div>
  )
}

// ─── UTM Generator tab ─────────────────────────────────────────────────────────

function UtmTab() {
  const [source, setSource]               = useState("facebook")
  const [medium, setMedium]               = useState("paid_social")
  const [baseUrl, setBaseUrl]             = useState("")
  const [includeAd, setIncludeAd]         = useState(true)
  const [includePlacement, setIncludePlacement] = useState(false)
  const [includeFbclid, setIncludeFbclid] = useState(true)

  function buildParams(preview = false) {
    const sub = (v: string) => preview ? (PREVIEW_SUBS[v] ?? v) : v
    const parts = [
      `utm_source=${source}`,
      `utm_medium=${medium}`,
      `utm_campaign=${sub("{{campaign.name}}")}`,
      `utm_content=${sub("{{adset.name}}")}`,
    ]
    if (includeAd)         parts.push(`utm_term=${sub("{{ad.name}}")}`)
    if (includePlacement)  parts.push(`utm_placement=${sub("{{placement}}")}`)
    if (includeFbclid)     parts.push(`fbclid=${sub("{{fbclid}}")}`)
    return parts.join("&")
  }

  const params      = buildParams(false)
  const previewParams = buildParams(true)
  const fullUrl     = baseUrl ? `${baseUrl.replace(/\?$/, "")}?${params}` : ""
  const previewUrl  = baseUrl ? `${baseUrl.replace(/\?$/, "")}?${previewParams}` : ""

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 space-y-5">
          <h2 className="text-[13px] font-semibold text-white">Configuração</h2>
          <div className="grid grid-cols-2 gap-4">
            <SelectField label="utm_source" value={source} options={SOURCES} onChange={setSource} />
            <SelectField label="utm_medium" value={medium} options={MEDIUMS} onChange={setMedium} />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Tokens dinâmicos</span>
            <div className="space-y-1.5">
              {[
                { key: "utm_campaign", token: "{{campaign.name}}", fixed: true },
                { key: "utm_content",  token: "{{adset.name}}",    fixed: true },
                { key: "utm_term",     token: "{{ad.name}}",       toggle: true, state: includeAd,        set: setIncludeAd },
                { key: "utm_placement",token: "{{placement}}",     toggle: true, state: includePlacement,  set: setIncludePlacement },
                { key: "fbclid",       token: "{{fbclid}}",        toggle: true, state: includeFbclid,     set: setIncludeFbclid },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] text-zinc-400 font-medium shrink-0">{item.key}</span>
                    <span className="text-[11px] text-violet-400 font-mono truncate">{item.token}</span>
                  </div>
                  {item.toggle ? (
                    <button onClick={() => item.set?.(!item.state)} className={`w-8 h-4 rounded-full transition-colors shrink-0 relative ${item.state ? "bg-violet-600" : "bg-white/[0.1]"}`}>
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${item.state ? "left-[calc(100%-14px)]" : "left-0.5"}`} />
                    </button>
                  ) : (
                    <span className="text-[10px] text-zinc-600 shrink-0">fixo</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">URL da página (opcional)</label>
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
              <Link2 size={13} className="text-zinc-600 shrink-0" />
              <input type="url" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://seusite.com/landing" className="flex-1 bg-transparent text-[13px] text-white placeholder-zinc-600 focus:outline-none" />
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 space-y-5">
          <h2 className="text-[13px] font-semibold text-white">Saída</h2>
          <CodeBlock label='Colar em "Parâmetros de URL" do criativo' value={params} />
          {fullUrl && <CodeBlock label="URL completa" value={fullUrl} />}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <RefreshCw size={11} className="text-zinc-600" />
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Preview com valores de exemplo</span>
            </div>
            <div className="bg-[#0d0d10] border border-white/[0.07] rounded-lg p-3.5 font-mono text-[11px] text-zinc-400 break-all leading-relaxed">
              {previewUrl || `?${previewParams}`}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-3">
        <h3 className="text-[13px] font-semibold text-white">Como usar no Meta Ads</h3>
        <ol className="space-y-2 text-[13px] text-zinc-400">
          <li className="flex gap-2.5"><span className="text-violet-400 font-semibold shrink-0">1.</span>Copie os <span className="text-white font-medium">Parâmetros de URL</span> gerados acima.</li>
          <li className="flex gap-2.5"><span className="text-violet-400 font-semibold shrink-0">2.</span>No gerenciador, vá em <span className="text-white font-medium">Criativo → Rastreamento → Parâmetros de URL</span> e cole.</li>
          <li className="flex gap-2.5"><span className="text-violet-400 font-semibold shrink-0">3.</span>O Meta substitui <span className="font-mono text-violet-300 text-[12px]">{"{{campaign.name}}"}</span> pelos valores reais na entrega.</li>
          <li className="flex gap-2.5"><span className="text-violet-400 font-semibold shrink-0">4.</span>Seu CRM lê os UTMs da URL e envia para o webhook abaixo — GTPRO exibe a atribuição na aba Leads.</li>
        </ol>
        <div className="mt-3 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
          <p className="text-[12px] text-violet-300"><span className="font-semibold">Dica:</span> use <span className="font-mono">utm_term</span> com <span className="font-mono">{"{{ad.name}}"}</span> para saber qual criativo gerou cada lead, não só o CTR.</p>
        </div>
      </div>
    </div>
  )
}

// ─── Leads attribution tab ──────────────────────────────────────────────────────

type Lead = {
  id: string; name: string | null; email: string | null; phone: string | null
  utm_source: string | null; utm_campaign: string | null; utm_content: string | null; utm_term: string | null
  created_at: string; source: string; converted_at: string | null; conversion_value: number | null
  capi_lead_sent: boolean; capi_purchase_sent: boolean
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item) || "—"
    acc[k] = [...(acc[k] ?? []), item]
    return acc
  }, {} as Record<string, T[]>)
}

function LeadsTable({ leads, onConverted }: {
  leads: Lead[]
  onConverted: (id: string, converted_at: string, value?: number) => void
}) {
  const [converting, setConverting] = useState<string | null>(null)

  async function handleConvert(lead: Lead) {
    const input = window.prompt(`Valor da venda em R$ (opcional) — ${lead.name ?? lead.email ?? lead.id}`)
    if (input === null) return
    const value = input.trim() ? parseFloat(input.replace(",", ".")) : undefined
    setConverting(lead.id)
    try {
      const res = await api.leads.convert(lead.id, value)
      onConverted(lead.id, res.converted_at, value)
    } catch {
      alert("Erro ao marcar como convertido.")
    } finally {
      setConverting(null)
    }
  }

  return (
    <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
        <span className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">Últimos leads</span>
        <span className="text-[11px] text-zinc-600">{leads.filter(l => l.converted_at).length} convertidos</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {["Nome", "Contato", "Campanha", "Conjunto", "Data", "Status", ""].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] text-zinc-600 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {leads.slice(0, 50).map(l => (
              <tr key={l.id} className={`border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors ${l.converted_at ? "opacity-75" : ""}`}>
                <td className="px-4 py-2.5 text-zinc-300">{l.name ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-500 max-w-[160px] truncate">{l.email ?? l.phone ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-400 max-w-[130px] truncate" title={l.utm_campaign ?? ""}>{l.utm_campaign ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-400 max-w-[130px] truncate" title={l.utm_content ?? ""}>{l.utm_content ?? "—"}</td>
                <td className="px-4 py-2.5 text-zinc-600 whitespace-nowrap">{new Date(l.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-2.5">
                  {l.converted_at ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-medium">
                      <TrendingUp size={9} />
                      {l.conversion_value ? `R$ ${l.conversion_value.toFixed(0)}` : "Convertido"}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/[0.06] text-zinc-500 text-[11px]">
                      Lead
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  {!l.converted_at && (
                    <button
                      onClick={() => handleConvert(l)}
                      disabled={converting === l.id}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-violet-600/20 hover:bg-violet-600/30 border border-violet-500/20 text-violet-300 text-[11px] transition-colors disabled:opacity-50"
                    >
                      <TrendingUp size={10} />
                      {converting === l.id ? "..." : "Converter"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LeadsTab() {
  const [leads, setLeads]         = useState<Lead[]>([])
  const [loading, setLoading]     = useState(true)
  const [preset, setPreset]       = useState("last_30d")
  const [token, setToken]         = useState<string | null>(null)
  const [regenerating, setRegen]  = useState(false)

  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhook/leads` : "/api/webhook/leads"

  useEffect(() => {
    api.webhook.get().then(d => setToken(d.webhook_token)).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    api.leads.list(preset).then(setLeads).catch(() => setLeads([])).finally(() => setLoading(false))
  }, [preset])

  async function regenerate() {
    setRegen(true)
    const d = await api.webhook.regenerate().catch(() => null)
    if (d) setToken(d.webhook_token)
    setRegen(false)
  }

  const byCampaign = groupBy(leads, l => l.utm_campaign ?? "Sem campanha")
  const byContent  = groupBy(leads, l => l.utm_content  ?? "Sem conjunto")
  const byTerm     = groupBy(leads, l => l.utm_term     ?? "Sem criativo")

  return (
    <div className="space-y-6">
      {/* Webhook config */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Key size={14} className="text-violet-400" />
          <h2 className="text-[13px] font-semibold text-white">Configuração do Webhook</h2>
        </div>
        <p className="text-[12px] text-zinc-500">Configure seu CRM para enviar um POST com os dados do lead + UTMs para este endpoint.</p>
        <div className="space-y-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">URL do Webhook</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#0d0d10] border border-white/[0.07] rounded-lg px-3 py-2 font-mono text-[12px] text-zinc-300 truncate">{webhookUrl}</div>
              <CopyBtn text={webhookUrl} size="xs" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">API Key (header: x-api-key)</span>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-[#0d0d10] border border-white/[0.07] rounded-lg px-3 py-2 font-mono text-[12px] text-zinc-300 truncate">{token ?? "Carregando..."}</div>
              {token && <CopyBtn text={token} size="xs" />}
              <button onClick={regenerate} disabled={regenerating} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.1] transition-colors text-[11px] text-zinc-400 shrink-0">
                <RotateCcw size={11} className={regenerating ? "animate-spin" : ""} />
                Novo
              </button>
            </div>
          </div>
        </div>

        {/* Payload example */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Payload esperado (JSON)</span>
          <div className="bg-[#0d0d10] border border-white/[0.07] rounded-lg p-3.5 font-mono text-[11px] text-zinc-400 space-y-0.5">
            <div>{`{`}</div>
            <div className="pl-4"><span className="text-violet-300">"name"</span>: <span className="text-emerald-300">"João Silva"</span>,</div>
            <div className="pl-4"><span className="text-violet-300">"email"</span>: <span className="text-emerald-300">"joao@email.com"</span>,</div>
            <div className="pl-4"><span className="text-violet-300">"phone"</span>: <span className="text-emerald-300">"11999999999"</span>,</div>
            <div className="pl-4"><span className="text-violet-300">"utm_source"</span>: <span className="text-emerald-300">"facebook"</span>,</div>
            <div className="pl-4"><span className="text-violet-300">"utm_medium"</span>: <span className="text-emerald-300">"paid_social"</span>,</div>
            <div className="pl-4"><span className="text-violet-300">"utm_campaign"</span>: <span className="text-emerald-300">"Conversão_Leads_Q2"</span>,</div>
            <div className="pl-4"><span className="text-violet-300">"utm_content"</span>: <span className="text-emerald-300">"Homens_25-44_SP"</span>,</div>
            <div className="pl-4"><span className="text-violet-300">"utm_term"</span>: <span className="text-emerald-300">"Criativo_VideoA"</span>,</div>
            <div className="pl-4"><span className="text-violet-300">"fbclid"</span>: <span className="text-emerald-300">"IwAR2..."</span></div>
            <div>{`}`}</div>
          </div>
        </div>
      </div>

      {/* Attribution dashboard */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-zinc-500" />
          <span className="text-[13px] font-semibold text-white">{leads.length} leads</span>
        </div>
        <div className="flex items-center gap-2">
          {DATE_PRESETS.map(p => (
            <button key={p.value} onClick={() => setPreset(p.value)} className={`px-3 py-1 rounded-md text-[12px] transition-colors ${preset === p.value ? "bg-violet-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-zinc-600 text-[13px]">Carregando leads...</div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16 space-y-2">
          <p className="text-zinc-500 text-[13px]">Nenhum lead recebido neste período.</p>
          <p className="text-zinc-600 text-[12px]">Configure o webhook acima no seu CRM para começar a rastrear.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {[
            { title: "Por campanha",  data: byCampaign },
            { title: "Por conjunto",  data: byContent },
            { title: "Por criativo",  data: byTerm },
          ].map(({ title, data }) => (
            <div key={title} className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-4 space-y-3">
              <h3 className="text-[12px] font-semibold text-zinc-400 uppercase tracking-wider">{title}</h3>
              <div className="space-y-2">
                {Object.entries(data)
                  .sort((a, b) => b[1].length - a[1].length)
                  .slice(0, 8)
                  .map(([name, items]) => {
                    const pct = Math.round((items.length / leads.length) * 100)
                    return (
                      <div key={name} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[12px] text-zinc-300 truncate max-w-[160px]" title={name}>{name}</span>
                          <span className="text-[12px] text-white font-medium shrink-0 ml-2">{items.length}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/[0.06]">
                          <div className="h-1 rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Leads table */}
      {leads.length > 0 && (
        <LeadsTable leads={leads} onConverted={(id, at, val) => {
          setLeads(prev => prev.map(l => l.id === id ? { ...l, converted_at: at, conversion_value: val ?? null } : l))
        }} />
      )}
    </div>
  )
}

// ─── Page ───────────────────────────────────────────────────────────────────────

type Tab = "utm" | "leads"

export default function RastreamentoPage() {
  const [tab, setTab] = useState<Tab>("utm")

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-white tracking-[-0.3px]">Rastreamento</h1>
          <p className="text-[13px] text-zinc-500 mt-1">Gere UTMs e acompanhe a atribuição de leads por campanha, conjunto e criativo.</p>
        </div>
        <div className="flex items-center gap-1 bg-white/[0.04] border border-white/[0.07] rounded-lg p-1">
          {([["utm", "Gerador UTM"], ["leads", "Leads & Atribuição"]] as [Tab, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setTab(v)} className={`px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors ${tab === v ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "utm" ? <UtmTab /> : <LeadsTab />}
    </div>
  )
}
