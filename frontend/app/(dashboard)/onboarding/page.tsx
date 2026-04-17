"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Check, ArrowRight, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const OBJETIVOS = [
  { value: "LEADS", label: "Geração de Leads", desc: "Formulários, WhatsApp, ligações" },
  { value: "SALES", label: "Vendas", desc: "E-commerce, compras online" },
  { value: "TRAFFIC", label: "Tráfego", desc: "Cliques no site, pageviews" },
  { value: "AWARENESS", label: "Reconhecimento", desc: "Alcance e brand awareness" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [metaConnected, setMetaConnected] = useState(false)
  const [connectingMeta, setConnectingMeta] = useState(false)
  const [hasCreds, setHasCreds] = useState(false)
  const [config, setConfig] = useState({ objetivo_principal: "LEADS", roas_minimo: 2, cpl_maximo: 50, modo_supervisionado: true })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get("/settings/platform"),
      api.meta.status().catch(() => ({ connected: false })),
    ]).then(([p, m]) => {
      setHasCreds(p.anthropic_api_key_set)
      setMetaConnected(m.connected)
      if (m.connected) setStep(2)
    })
  }, [])

  async function connectMeta() {
    setConnectingMeta(true)
    try {
      const { url } = await api.meta.connect()
      window.location.href = url
    } catch (e: any) {
      alert(e.message)
      setConnectingMeta(false)
    }
  }

  async function finish() {
    setSaving(true)
    try {
      await api.tenant.save({ ...config, roas_minimo: Number(config.roas_minimo), cpl_maximo: Number(config.cpl_maximo) })
      router.push("/campanhas")
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full flex items-start justify-center pt-12">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="mb-8">
          <p className="text-[11px] font-medium text-violet-400 uppercase tracking-widest mb-2">Configuração inicial</p>
          <h1 className="text-xl font-semibold text-white">Configure o GTPRO</h1>
          <p className="text-sm text-zinc-500 mt-1">Dois passos para começar a gerenciar suas campanhas com IA.</p>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-6">
          {[
            { n: 1, label: "Conectar Meta Ads" },
            { n: 2, label: "Objetivos" },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors",
                  step > s.n ? "bg-emerald-600" : step === s.n ? "bg-violet-600" : "bg-zinc-800 text-zinc-500"
                )}>
                  {step > s.n ? <Check size={9} /> : <span className="text-white">{s.n}</span>}
                </div>
                <span className={cn("text-[12px]", step >= s.n ? "text-zinc-300" : "text-zinc-600")}>{s.label}</span>
              </div>
              {i < 1 && <div className={cn("flex-1 h-px w-8", step > s.n ? "bg-emerald-600/50" : "bg-zinc-800")} />}
            </div>
          ))}
        </div>

        {/* Step 1 — Meta */}
        {step === 1 && (
          <div className="bg-white/[0.03] ring-1 ring-white/[0.07] rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-[14px] font-semibold text-white">Conectar Meta Ads</h2>
              <p className="text-[12px] text-zinc-500 mt-1">O agente precisa de acesso para ler e otimizar suas campanhas.</p>
            </div>

            {!hasCreds && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-[12px] text-amber-400">
                Configure o Meta App ID em{" "}
                <button onClick={() => router.push("/configuracoes")} className="underline font-medium">Configurações</button>{" "}
                antes de continuar.
              </div>
            )}

            {metaConnected ? (
              <div className="flex items-center gap-2 text-[13px] text-emerald-400">
                <Check size={14} /> Conta conectada
              </div>
            ) : (
              <button
                onClick={connectMeta}
                disabled={connectingMeta || !hasCreds}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-white text-zinc-900 text-[13px] font-semibold rounded-lg hover:bg-zinc-100 disabled:opacity-40 transition-colors"
              >
                {connectingMeta ? <><Loader2 size={14} className="animate-spin" /> Redirecionando...</> : "Conectar Meta Ads"}
              </button>
            )}

            <div className="flex items-center justify-between pt-1">
              <button onClick={() => setStep(2)} className="text-[12px] text-zinc-600 hover:text-zinc-400 transition-colors">
                Pular por agora
              </button>
              {metaConnected && (
                <button onClick={() => setStep(2)} className="flex items-center gap-1 text-[13px] text-violet-400 font-medium hover:text-violet-300 transition-colors">
                  Continuar <ArrowRight size={13} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2 — Config */}
        {step === 2 && (
          <div className="bg-white/[0.03] ring-1 ring-white/[0.07] rounded-xl p-6 space-y-5">
            <div>
              <h2 className="text-[14px] font-semibold text-white">Objetivos e limites</h2>
              <p className="text-[12px] text-zinc-500 mt-1">O agente usa esses parâmetros para avaliar e otimizar campanhas.</p>
            </div>

            {/* Objetivo */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-2">Objetivo principal</label>
              <div className="space-y-1">
                {OBJETIVOS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setConfig((c) => ({ ...c, objetivo_principal: o.value }))}
                    className={cn(
                      "w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-left transition-colors",
                      config.objetivo_principal === o.value
                        ? "bg-violet-600/15 ring-1 ring-violet-500/30"
                        : "hover:bg-white/[0.04] ring-1 ring-transparent"
                    )}
                  >
                    <div>
                      <p className={cn("text-[13px] font-medium", config.objetivo_principal === o.value ? "text-white" : "text-zinc-300")}>{o.label}</p>
                      <p className="text-[11px] text-zinc-500">{o.desc}</p>
                    </div>
                    {config.objetivo_principal === o.value && (
                      <div className="w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center shrink-0">
                        <Check size={9} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-1.5">ROAS mínimo</label>
                <input
                  type="number" step="0.1" min="0"
                  value={config.roas_minimo}
                  onChange={(e) => setConfig((c) => ({ ...c, roas_minimo: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg text-[13px] text-white focus:outline-none focus:ring-violet-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-1.5">CPL máx (R$)</label>
                <input
                  type="number" step="1" min="0"
                  value={config.cpl_maximo}
                  onChange={(e) => setConfig((c) => ({ ...c, cpl_maximo: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg text-[13px] text-white focus:outline-none focus:ring-violet-500/50 transition-all"
                />
              </div>
            </div>

            {/* Supervised mode */}
            <div className="flex items-center justify-between py-3 border-t border-white/[0.05]">
              <div>
                <p className="text-[13px] font-medium text-zinc-200">Modo supervisionado</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Agente propõe — você aprova antes de executar</p>
              </div>
              <button
                onClick={() => setConfig((c) => ({ ...c, modo_supervisionado: !c.modo_supervisionado }))}
                className={cn("shrink-0 w-10 h-[22px] rounded-full transition-colors relative", config.modo_supervisionado ? "bg-violet-600" : "bg-zinc-700")}
              >
                <span className={cn("absolute top-[3px] w-4 h-4 bg-white rounded-full shadow transition-transform", config.modo_supervisionado ? "translate-x-[22px]" : "translate-x-[3px]")} />
              </button>
            </div>

            <button
              onClick={finish}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg transition-colors"
            >
              {saving ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <>Concluir <ArrowRight size={14} /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
