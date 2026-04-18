"use client"

import { useState, useCallback } from "react"
import { Copy, Check, Link2, ChevronDown, RefreshCw } from "lucide-react"

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

const DYNAMIC_TOKENS = {
  campaign: "{{campaign.name}}",
  adset: "{{adset.name}}",
  ad: "{{ad.name}}",
  placement: "{{placement}}",
  site_source: "{{site_source_name}}",
  fbclid: "{{fbclid}}",
}

const PREVIEW_SUBS: Record<string, string> = {
  "{{campaign.name}}": "Conversão_Leads_Q2",
  "{{adset.name}}": "Homens_25-44_SP",
  "{{ad.name}}": "Criativo_VideoA",
  "{{placement}}": "feed",
  "{{site_source_name}}": "fb",
  "{{fbclid}}": "IwAR2abc123xyz",
}

function SelectField({
  label, value, options, onChange,
}: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full appearance-none bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-[13px] text-white pr-8 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
        >
          {options.map(o => (
            <option key={o.value} value={o.value} className="bg-[#0b0b0d]">{o.label}</option>
          ))}
        </select>
        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
      </div>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [text])
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/[0.06] hover:bg-white/[0.1] transition-colors text-[12px] text-zinc-300 shrink-0"
    >
      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
      {copied ? "Copiado" : "Copiar"}
    </button>
  )
}

function CodeBlock({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        <CopyButton text={value} />
      </div>
      <div className="bg-[#0d0d10] border border-white/[0.07] rounded-lg p-3.5 font-mono text-[12px] text-violet-300 break-all leading-relaxed">
        {value}
      </div>
    </div>
  )
}

export default function RastreamentoPage() {
  const [source, setSource] = useState("facebook")
  const [medium, setMedium] = useState("paid_social")
  const [baseUrl, setBaseUrl] = useState("")
  const [includeAd, setIncludeAd] = useState(true)
  const [includePlacement, setIncludePlacement] = useState(false)
  const [includeFbclid, setIncludeFbclid] = useState(true)

  function buildParams(usePreview = false) {
    const sub = (v: string) => usePreview ? (PREVIEW_SUBS[v] ?? v) : v
    const params: string[] = [
      `utm_source=${source}`,
      `utm_medium=${medium}`,
      `utm_campaign=${sub(DYNAMIC_TOKENS.campaign)}`,
      `utm_content=${sub(DYNAMIC_TOKENS.adset)}`,
    ]
    if (includeAd) params.push(`utm_term=${sub(DYNAMIC_TOKENS.ad)}`)
    if (includePlacement) params.push(`utm_placement=${sub(DYNAMIC_TOKENS.placement)}`)
    if (includeFbclid) params.push(`fbclid=${sub(DYNAMIC_TOKENS.fbclid)}`)
    return params.join("&")
  }

  const params = buildParams(false)
  const previewParams = buildParams(true)
  const fullUrl = baseUrl ? `${baseUrl.replace(/\?$/, "")}?${params}` : ""
  const previewUrl = baseUrl ? `${baseUrl.replace(/\?$/, "")}?${previewParams}` : ""

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-semibold text-white tracking-[-0.3px]">Rastreamento UTM</h1>
        <p className="text-[13px] text-zinc-500 mt-1">
          Gere parâmetros com tokens dinâmicos do Meta para rastrear leads por campanha, conjunto e criativo.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Config panel */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 space-y-5">
          <h2 className="text-[13px] font-semibold text-white">Configuração</h2>

          <div className="grid grid-cols-2 gap-4">
            <SelectField label="Fonte (utm_source)" value={source} options={SOURCES} onChange={setSource} />
            <SelectField label="Meio (utm_medium)" value={medium} options={MEDIUMS} onChange={setMedium} />
          </div>

          {/* Dynamic fields info */}
          <div className="space-y-2">
            <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Tokens dinâmicos incluídos</span>
            <div className="space-y-1.5">
              {[
                { key: "utm_campaign", token: DYNAMIC_TOKENS.campaign, fixed: true },
                { key: "utm_content", token: DYNAMIC_TOKENS.adset, fixed: true },
                { key: "utm_term", token: DYNAMIC_TOKENS.ad, toggle: true, state: includeAd, setState: setIncludeAd },
                { key: "utm_placement", token: DYNAMIC_TOKENS.placement, toggle: true, state: includePlacement, setState: setIncludePlacement },
                { key: "fbclid", token: DYNAMIC_TOKENS.fbclid, toggle: true, state: includeFbclid, setState: setIncludeFbclid },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/[0.05]">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] text-zinc-400 font-medium shrink-0">{item.key}</span>
                    <span className="text-[11px] text-violet-400 font-mono truncate">{item.token}</span>
                  </div>
                  {item.toggle ? (
                    <button
                      onClick={() => item.setState?.(!item.state)}
                      className={`w-8 h-4 rounded-full transition-colors shrink-0 relative ${item.state ? "bg-violet-600" : "bg-white/[0.1]"}`}
                    >
                      <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${item.state ? "left-[calc(100%-14px)]" : "left-0.5"}`} />
                    </button>
                  ) : (
                    <span className="text-[10px] text-zinc-600 shrink-0">fixo</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Base URL */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">URL da página de destino (opcional)</label>
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2">
              <Link2 size={13} className="text-zinc-600 shrink-0" />
              <input
                type="url"
                value={baseUrl}
                onChange={e => setBaseUrl(e.target.value)}
                placeholder="https://seusite.com/landing"
                className="flex-1 bg-transparent text-[13px] text-white placeholder-zinc-600 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Output panel */}
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-xl p-5 space-y-5">
          <h2 className="text-[13px] font-semibold text-white">Saída</h2>

          {/* Params only — paste in Meta's URL Parameters field */}
          <CodeBlock
            label='Parâmetros — colar em "Parâmetros de URL" do criativo'
            value={params}
          />

          {/* Full URL if base provided */}
          {fullUrl && (
            <CodeBlock
              label="URL completa com parâmetros"
              value={fullUrl}
            />
          )}

          {/* Preview with example values */}
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

      {/* How to use */}
      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-5 space-y-3">
        <h3 className="text-[13px] font-semibold text-white">Como usar no Meta Ads</h3>
        <ol className="space-y-2 text-[13px] text-zinc-400">
          <li className="flex gap-2.5">
            <span className="text-violet-400 font-semibold shrink-0">1.</span>
            Copie os <span className="text-white font-medium">Parâmetros de URL</span> gerados acima.
          </li>
          <li className="flex gap-2.5">
            <span className="text-violet-400 font-semibold shrink-0">2.</span>
            No gerenciador de anúncios, vá em <span className="text-white font-medium">Criativo → Rastreamento → Parâmetros de URL</span> e cole.
          </li>
          <li className="flex gap-2.5">
            <span className="text-violet-400 font-semibold shrink-0">3.</span>
            O Meta substitui automaticamente os tokens <span className="font-mono text-violet-300 text-[12px]">{'{{campaign.name}}'}</span> pelos valores reais de cada anúncio na entrega.
          </li>
          <li className="flex gap-2.5">
            <span className="text-violet-400 font-semibold shrink-0">4.</span>
            No seu CRM ou página de captura, leia os parâmetros UTM da URL para saber a origem exata de cada lead.
          </li>
        </ol>

        <div className="mt-3 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
          <p className="text-[12px] text-violet-300">
            <span className="font-semibold">Dica:</span> use o <span className="font-medium">utm_term</span> com <span className="font-mono">{'{{ad.name}}'}</span> para identificar qual criativo gerou cada lead — isso permite otimizar criativos com base em qualidade de lead, não apenas CTR.
          </p>
        </div>
      </div>
    </div>
  )
}
