"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Check, ChevronRight, Loader2 } from "lucide-react"

const STEPS = ["welcome", "intro", "meta", "agent", "whatsapp", "done"] as const
type Step = typeof STEPS[number]

const inputCls = "w-full px-3.5 py-2.5 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50 transition-all"
const OBJETIVOS = [
  { value: "LEADS",    label: "Geração de Leads" },
  { value: "SALES",    label: "Vendas / E-commerce" },
  { value: "MESSAGES", label: "Mensagens WhatsApp" },
  { value: "TRAFFIC",  label: "Tráfego" },
]

export default function OnboardingPage() {
  const [step, setStep]     = useState<Step>("welcome")
  const [name, setName]     = useState("")
  const [token, setToken]   = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Meta step state
  const [metaAppId, setMetaAppId]       = useState("")
  const [metaSecret, setMetaSecret]     = useState("")
  const [metaSaving, setMetaSaving]     = useState(false)
  const [metaConnected, setMetaConnected] = useState(false)

  // Agent step state
  const [agentCfg, setAgentCfg] = useState({ objetivo_principal: "LEADS", roas_minimo: 2, cpl_maximo: 50 })

  // WhatsApp step state
  const [waCfg, setWaCfg] = useState({ whatsapp_number: "", daily_analysis_enabled: false })

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push("/login"); return }
      setToken(session.access_token)
      const userName = session.user.user_metadata?.name ?? ""
      setName(userName)

      // Check if already onboarded
      fetch("/api/auth/me", { headers: { Authorization: `Bearer ${session.access_token}` } })
        .then(r => r.json())
        .then(d => { if (d.onboarding_completed) router.push("/campanhas") })
    })
  }, [])

  async function apiPost(path: string, body: object) {
    const res = await fetch(`/api${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    return res.json()
  }

  async function apiGet(path: string) {
    const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } })
    return res.json()
  }

  async function connectOAuth() {
    setMetaSaving(true)
    try {
      const d = await apiGet("/meta/connect")
      if (d.url) window.location.href = d.url
      else setMetaSaving(false)
    } catch { setMetaSaving(false) }
  }

  async function checkMetaStatus() {
    const d = await apiGet("/meta/status")
    if (d.connected) setMetaConnected(true)
    return d.connected
  }

  async function saveAgent() {
    setSaving(true)
    await apiPost("/settings/tenant", agentCfg)
    setSaving(false)
    setStep("whatsapp")
  }

  async function saveWhatsApp(skip = false) {
    setSaving(true)
    if (!skip && waCfg.whatsapp_number) {
      await apiPost("/settings/whatsapp", {
        whatsapp_number: waCfg.whatsapp_number,
        daily_analysis_enabled: waCfg.daily_analysis_enabled,
      })
    }
    setSaving(false)
    setStep("done")
  }

  async function complete() {
    setSaving(true)
    await apiPost("/auth/complete-onboarding", {})
    setSaving(false)
    router.push("/campanhas")
  }

  const next = (s: Step) => setStep(s)

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
        <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08080a] px-4">
      <div className="w-full max-w-[440px]">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Image src="/logo.png" alt="GTPRO" width={120} height={40} className="object-contain" priority />
        </div>

        {/* Progress dots */}
        {step !== "welcome" && step !== "intro" && step !== "done" && (
          <div className="flex justify-center gap-2 mb-8">
            {(["meta", "agent", "whatsapp"] as Step[]).map(s => (
              <div key={s} className={`w-2 h-2 rounded-full transition-colors ${
                STEPS.indexOf(step) >= STEPS.indexOf(s) ? "bg-violet-500" : "bg-zinc-700"
              }`} />
            ))}
          </div>
        )}

        <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-2xl p-8">

          {/* ── Welcome ── */}
          {step === "welcome" && (
            <div className="text-center space-y-5">
              <div className="text-4xl">👋</div>
              <div>
                <h1 className="text-xl font-semibold text-white">
                  Olá, {name}!<br />Seja bem-vindo ao GTPRO.
                </h1>
                <p className="text-[13px] text-zinc-500 mt-2">
                  Sua plataforma de gestão de tráfego com inteligência artificial.
                </p>
              </div>
              <button onClick={() => next("intro")} className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                Próximo <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* ── Intro ── */}
          {step === "intro" && (
            <div className="text-center space-y-5">
              <div className="text-4xl">🚀</div>
              <div>
                <h1 className="text-lg font-semibold text-white">Vamos configurar sua conta</h1>
                <p className="text-[13px] text-zinc-500 mt-2 leading-relaxed">
                  São apenas 3 passos rápidos para você ter acesso completo ao GTPRO. Vamos lá?
                </p>
              </div>
              <div className="space-y-2 text-left">
                {["Conectar sua conta de anúncios Meta", "Definir metas do agente", "Configurar notificações"].map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-[13px] text-zinc-400">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 ring-1 ring-violet-500/30 flex items-center justify-center text-[11px] text-violet-400 font-medium shrink-0">{i + 1}</div>
                    {t}
                  </div>
                ))}
              </div>
              <button onClick={() => next("meta")} className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                Vamos lá <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* ── Meta Ads ── */}
          {step === "meta" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white">Conectar Meta Ads</h2>
                <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">
                  Conecte sua conta de anúncios para o GTPRO importar campanhas e insights automaticamente.
                </p>
              </div>

              {/* How-to steps */}
              <div className="space-y-2.5 bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-4">
                <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Como conectar</p>
                {[
                  "Clique em \"Conectar via OAuth\" abaixo",
                  "Faça login com o Facebook vinculado ao seu BM",
                  "Autorize o GTPRO a acessar seus anúncios",
                  "Selecione a conta de anúncios e pronto!",
                ].map((t, i) => (
                  <div key={i} className="flex items-start gap-3 text-[12px] text-zinc-400">
                    <div className="w-5 h-5 rounded-full bg-violet-500/20 ring-1 ring-violet-500/30 flex items-center justify-center text-[10px] text-violet-400 font-semibold shrink-0 mt-0.5">{i + 1}</div>
                    {t}
                  </div>
                ))}
                <p className="text-[11px] text-zinc-600 pt-1">
                  Prefere usar um <strong className="text-zinc-400">System User Token</strong>? Pule agora e configure em <strong className="text-zinc-400">Configurações → Meta Ads</strong>.
                </p>
              </div>

              {metaConnected ? (
                <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-[13px] font-medium text-emerald-300">Meta Ads conectado!</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={connectOAuth}
                    disabled={metaSaving}
                    className="w-full py-2.5 bg-[#1877f2] hover:bg-[#166fe5] disabled:opacity-40 text-white text-[13px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    {metaSaving ? <Loader2 size={14} className="animate-spin" /> : null}
                    Conectar via OAuth
                  </button>
                  <button
                    onClick={checkMetaStatus}
                    className="w-full py-2 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Já conectei, verificar status
                  </button>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                {metaConnected && (
                  <button onClick={() => next("agent")} className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                    Próximo <ChevronRight size={15} />
                  </button>
                )}
                <button onClick={() => next("agent")} className={`${metaConnected ? "flex-none px-4" : "flex-1"} py-2.5 bg-white/[0.04] hover:bg-white/[0.07] ring-1 ring-white/[0.08] text-zinc-400 text-[13px] rounded-lg transition-colors`}>
                  {metaConnected ? "Pular" : "Configurar depois"}
                </button>
              </div>
            </div>
          )}

          {/* ── Agent config ── */}
          {step === "agent" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white">Parâmetros do agente</h2>
                <p className="text-[12px] text-zinc-500 mt-1">O agente usará essas metas para avaliar e otimizar suas campanhas.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5 block">Objetivo principal</label>
                  <div className="grid grid-cols-2 gap-2">
                    {OBJETIVOS.map(o => (
                      <button key={o.value} type="button" onClick={() => setAgentCfg(c => ({ ...c, objetivo_principal: o.value }))}
                        className={`px-3 py-2.5 rounded-lg ring-1 text-[12px] font-medium text-left transition-all ${agentCfg.objetivo_principal === o.value ? "bg-violet-500/10 ring-violet-500/30 text-white" : "bg-white/[0.02] ring-white/[0.07] text-zinc-500 hover:text-zinc-300"}`}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5 block">CPL máximo (R$)</label>
                    <input type="number" min="1" value={agentCfg.cpl_maximo} onChange={e => setAgentCfg(c => ({ ...c, cpl_maximo: +e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5 block">ROAS mínimo</label>
                    <input type="number" min="0.1" step="0.1" value={agentCfg.roas_minimo} onChange={e => setAgentCfg(c => ({ ...c, roas_minimo: +e.target.value }))} className={inputCls} />
                  </div>
                </div>
              </div>

              <button onClick={saveAgent} disabled={saving} className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Próximo <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* ── WhatsApp ── */}
          {step === "whatsapp" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-base font-semibold text-white">Notificações WhatsApp</h2>
                <p className="text-[12px] text-zinc-500 mt-1">Receba alertas e relatórios diários direto no seu WhatsApp.</p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-zinc-500 uppercase tracking-widest font-medium mb-1.5 block">Seu número (ex: 5511999999999)</label>
                  <input type="tel" placeholder="5511999999999" value={waCfg.whatsapp_number} onChange={e => setWaCfg(c => ({ ...c, whatsapp_number: e.target.value }))} className={inputCls} />
                </div>

                <div className="flex items-center justify-between px-3.5 py-3 bg-white/[0.03] ring-1 ring-white/[0.06] rounded-lg">
                  <div>
                    <p className="text-[13px] font-medium text-zinc-200">Análise diária autônoma</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">Receba 2 relatórios por dia com insights</p>
                  </div>
                  <button type="button" onClick={() => setWaCfg(c => ({ ...c, daily_analysis_enabled: !c.daily_analysis_enabled }))}
                    className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${waCfg.daily_analysis_enabled ? "bg-violet-600" : "bg-zinc-700"}`}>
                    <span className={`pointer-events-none absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${waCfg.daily_analysis_enabled ? "translate-x-5" : "translate-x-0"}`} />
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => saveWhatsApp(false)} disabled={saving || !waCfg.whatsapp_number}
                  className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  Próximo <ChevronRight size={15} />
                </button>
                <button onClick={() => saveWhatsApp(true)} className="px-4 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] ring-1 ring-white/[0.08] text-zinc-400 text-[13px] rounded-lg transition-colors">
                  Pular
                </button>
              </div>
            </div>
          )}

          {/* ── Done ── */}
          {step === "done" && (
            <div className="text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20 flex items-center justify-center mx-auto">
                <Check size={24} className="text-emerald-400" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white">Tudo pronto, {name}!</h1>
                <p className="text-[13px] text-zinc-500 mt-2">
                  Sua conta está configurada. Você pode ajustar qualquer configuração a qualquer momento em Configurações.
                </p>
              </div>
              <button onClick={complete} disabled={saving} className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
                {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                Acessar o GTPRO 🚀
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
