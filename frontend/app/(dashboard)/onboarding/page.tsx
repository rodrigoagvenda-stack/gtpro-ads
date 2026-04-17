"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api"
import { Check, Link2, Settings, Zap, Loader2, ArrowRight } from "lucide-react"

const OBJETIVOS = [
  { value: "LEADS", label: "Geração de Leads", desc: "Formulários, WhatsApp, ligações" },
  { value: "SALES", label: "Vendas / E-commerce", desc: "Compras, add to cart, checkout" },
  { value: "TRAFFIC", label: "Tráfego", desc: "Cliques no site, visualizações de página" },
  { value: "AWARENESS", label: "Reconhecimento", desc: "Alcance, impressões, brand awareness" },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [metaConnected, setMetaConnected] = useState(false)
  const [connectingMeta, setConnectingMeta] = useState(false)
  const [hasPlatformCreds, setHasPlatformCreds] = useState(false)
  const [config, setConfig] = useState({
    objetivo_principal: "LEADS",
    roas_minimo: 2,
    cpl_maximo: 50,
    modo_supervisionado: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get("/settings/platform"),
      api.meta.status().catch(() => ({ connected: false })),
    ]).then(([platform, meta]) => {
      setHasPlatformCreds(platform.anthropic_api_key_set)
      setMetaConnected(meta.connected)
      if (meta.connected) setStep(2)
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
      await api.tenant.save({
        ...config,
        roas_minimo: Number(config.roas_minimo),
        cpl_maximo: Number(config.cpl_maximo),
      })
      router.push("/campanhas")
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-full flex items-start justify-center pt-16">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-violet-600/20 mb-2">
            <Zap size={24} className="text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Configuração inicial</h1>
          <p className="text-zinc-400 text-sm">Configure o GTPRO em 2 passos rápidos</p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          {[1, 2].map((s) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step > s ? "bg-emerald-600 text-white" : step === s ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-500"
              }`}>
                {step > s ? <Check size={12} /> : s}
              </div>
              <span className={`text-xs ${step >= s ? "text-zinc-300" : "text-zinc-600"}`}>
                {s === 1 ? "Conectar Meta Ads" : "Objetivos e limites"}
              </span>
              {s < 2 && <div className={`flex-1 h-px ${step > s ? "bg-emerald-600" : "bg-zinc-800"}`} />}
            </div>
          ))}
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                <Link2 size={18} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Conectar conta Meta Ads</h2>
                <p className="text-xs text-zinc-400">O agente precisa de acesso para gerenciar suas campanhas</p>
              </div>
            </div>

            {!hasPlatformCreds && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 text-xs text-yellow-400">
                Configure o Meta App ID e App Secret em{" "}
                <button onClick={() => router.push("/configuracoes")} className="underline font-medium">Configurações</button>{" "}
                antes de continuar.
              </div>
            )}

            {metaConnected ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <Check size={16} /> Conta conectada com sucesso
              </div>
            ) : (
              <button
                onClick={connectMeta}
                disabled={connectingMeta || !hasPlatformCreds}
                className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
              >
                {connectingMeta ? <><Loader2 size={16} className="animate-spin" /> Redirecionando...</> : <><Link2 size={16} /> Conectar Meta Ads</>}
              </button>
            )}

            <div className="flex justify-between pt-2">
              <button onClick={() => setStep(2)} className="text-xs text-zinc-500 hover:text-zinc-300 underline">
                Pular por agora
              </button>
              {metaConnected && (
                <button onClick={() => setStep(2)} className="flex items-center gap-1.5 text-sm text-violet-400 font-medium hover:text-violet-300">
                  Continuar <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-600/20 flex items-center justify-center">
                <Settings size={18} className="text-violet-400" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-white">Objetivos e limites</h2>
                <p className="text-xs text-zinc-400">O agente usa esses parâmetros para avaliar performance</p>
              </div>
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-2">Qual seu objetivo principal?</label>
              <div className="grid grid-cols-2 gap-2">
                {OBJETIVOS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setConfig((c) => ({ ...c, objetivo_principal: o.value }))}
                    className={`text-left px-4 py-3 rounded-lg border transition-colors ${
                      config.objetivo_principal === o.value
                        ? "border-violet-500 bg-violet-600/10 text-white"
                        : "border-zinc-700 bg-zinc-800 text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    <p className="text-sm font-medium">{o.label}</p>
                    <p className="text-xs text-zinc-500 mt-0.5">{o.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">ROAS mínimo</label>
                <input
                  type="number" step="0.1" min="0"
                  value={config.roas_minimo}
                  onChange={(e) => setConfig((c) => ({ ...c, roas_minimo: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1.5">CPL máximo (R$)</label>
                <input
                  type="number" step="1" min="0"
                  value={config.cpl_maximo}
                  onChange={(e) => setConfig((c) => ({ ...c, cpl_maximo: Number(e.target.value) }))}
                  className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>

            <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-3">
              <div>
                <p className="text-sm font-medium text-zinc-200">Modo supervisionado</p>
                <p className="text-xs text-zinc-500 mt-0.5">Agente propõe — você aprova</p>
              </div>
              <button
                onClick={() => setConfig((c) => ({ ...c, modo_supervisionado: !c.modo_supervisionado }))}
                className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${config.modo_supervisionado ? "bg-violet-600" : "bg-zinc-700"}`}
              >
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${config.modo_supervisionado ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            <button
              onClick={finish}
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? <><Loader2 size={16} className="animate-spin" /> Salvando...</> : <>Concluir configuração <ArrowRight size={16} /></>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
