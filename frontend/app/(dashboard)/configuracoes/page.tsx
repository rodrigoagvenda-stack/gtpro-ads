"use client"

import { useEffect, useState, Suspense, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import {
  Check, Copy, Eye, EyeOff, Plus, Trash2, RefreshCw, Link2, Unlink,
  Loader2, LayoutGrid, Pencil, Bot, Megaphone, Bell, MessageCircle,
  Zap, Key, Settings, Smartphone, QrCode, RotateCcw,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKey { id: string; name: string; scope: string; active: boolean; created_at: string }
interface Skill  { id: string; name: string; icon: string; color: string; prompt: string; is_default: boolean; tenant_id: string | null }
interface AlertCfg { type: string; label: string; description: string; enabled: boolean; channels: string[] }

const OBJETIVOS = [
  { value: "LEADS",       label: "Geração de Leads" },
  { value: "SALES",       label: "Vendas / E-commerce" },
  { value: "TRAFFIC",     label: "Tráfego" },
  { value: "AWARENESS",   label: "Reconhecimento" },
  { value: "APP_INSTALLS",label: "Instalações de app" },
]

const TABS = [
  { id: "agente",     label: "Agente",     icon: Bot },
  { id: "meta",       label: "Meta Ads",   icon: Megaphone },
  { id: "alertas",    label: "Alertas",    icon: Bell },
  { id: "whatsapp",   label: "WhatsApp",   icon: MessageCircle },
  { id: "skills",     label: "Skills",     icon: Zap },
  { id: "plataforma", label: "Plataforma", icon: Settings },
]

// ─── Shared components ────────────────────────────────────────────────────────

const inputCls = "w-full px-3.5 py-2.5 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50 transition-all [color-scheme:dark]"

function Field({ label, badge, children }: { label: string; badge?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-1.5">
        {label}
        {badge && <span className="text-emerald-500 normal-case tracking-normal font-medium">● {badge}</span>}
      </label>
      {children}
    </div>
  )
}

function SaveBtn({ saving, saved, onClick, label = "Salvar" }: { saving: boolean; saved: boolean; onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.09] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg ring-1 ring-white/[0.08] transition-colors">
      {saved ? <><Check size={13} className="text-emerald-400" /> Salvo</> : saving ? <><RefreshCw size={13} className="animate-spin" /> Salvando...</> : label}
    </button>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className={cn("shrink-0 w-11 h-6 rounded-full transition-colors relative", value ? "bg-violet-600" : "bg-zinc-700")}>
      <span className={cn("pointer-events-none absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", value ? "translate-x-5" : "translate-x-0")} />
    </button>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-6 space-y-5", className)}>{children}</div>
}

// ─── Tab: Agente ──────────────────────────────────────────────────────────────

function AgenteTab() {
  const [cfg, setCfg] = useState({ objetivo_principal: "LEADS", roas_minimo: 2, cpl_maximo: 50, budget_mensal: "", modo_supervisionado: true, limite_budget_sem_aprovacao: 100 })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.tenant.get().then(d => setCfg({ objetivo_principal: d.objetivo_principal ?? "LEADS", roas_minimo: d.roas_minimo ?? 2, cpl_maximo: d.cpl_maximo ?? 50, budget_mensal: d.budget_mensal ?? "", modo_supervisionado: d.modo_supervisionado ?? true, limite_budget_sem_aprovacao: d.limite_budget_sem_aprovacao ?? 100 })).catch(() => {})
  }, [])

  async function save() {
    setSaving(true)
    try {
      await api.tenant.save({ ...cfg, roas_minimo: Number(cfg.roas_minimo), cpl_maximo: Number(cfg.cpl_maximo), budget_mensal: cfg.budget_mensal ? Number(cfg.budget_mensal) : null, limite_budget_sem_aprovacao: Number(cfg.limite_budget_sem_aprovacao) })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">Parâmetros de performance</h2>
        <p className="text-[12px] text-zinc-600 -mt-3">Valores que o agente usa para avaliar campanhas e tomar decisões.</p>
        <div className="space-y-3">
          <Field label="Objetivo principal">
            <select value={cfg.objetivo_principal} onChange={e => setCfg(c => ({ ...c, objetivo_principal: e.target.value }))} className={inputCls}>
              {OBJETIVOS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ROAS mínimo"><input type="number" step="0.1" min="0" value={cfg.roas_minimo} onChange={e => setCfg(c => ({ ...c, roas_minimo: Number(e.target.value) }))} className={inputCls} /></Field>
            <Field label="CPL máximo (R$)"><input type="number" step="1" min="0" value={cfg.cpl_maximo} onChange={e => setCfg(c => ({ ...c, cpl_maximo: Number(e.target.value) }))} className={inputCls} /></Field>
            <Field label="Budget mensal (R$)"><input type="number" step="100" min="0" placeholder="Opcional" value={cfg.budget_mensal} onChange={e => setCfg(c => ({ ...c, budget_mensal: e.target.value }))} className={inputCls} /></Field>
            <Field label="Limite sem aprovação (R$)"><input type="number" step="50" min="0" value={cfg.limite_budget_sem_aprovacao} onChange={e => setCfg(c => ({ ...c, limite_budget_sem_aprovacao: Number(e.target.value) }))} className={inputCls} /></Field>
          </div>
        </div>
        <SaveBtn saving={saving} saved={saved} onClick={save} />
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-zinc-200">Modo supervisionado</p>
            <p className="text-[12px] text-zinc-600 mt-0.5">Agente propõe ações — você aprova antes de executar.</p>
          </div>
          <Toggle value={cfg.modo_supervisionado} onChange={v => { setCfg(c => ({ ...c, modo_supervisionado: v })); setSaved(false) }} />
        </div>
        <SaveBtn saving={saving} saved={saved} onClick={save} />
      </Card>
    </div>
  )
}

// ─── Tab: Meta Ads ────────────────────────────────────────────────────────────

interface MetaAccount { id: string; ad_account_id: string; name: string; is_active: boolean; created_at: string }

function MetaTab() {
  const searchParams = useSearchParams()
  const [platform, setPlatform] = useState({ anthropic_api_key_set: false, meta_app_id: "", meta_app_secret_set: false })
  const [form, setForm] = useState({ meta_app_id: "", meta_app_secret: "" })
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [metaStatus, setMetaStatus] = useState<{ connected: boolean; ad_account_id?: string; connected_at?: string } | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [metaMsg, setMetaMsg] = useState<{ type: "ok"|"err"|"info"; text: string } | null>(null)
  const [manualToken, setManualToken] = useState("")
  const [manualAccount, setManualAccount] = useState("")
  const [savingToken, setSavingToken] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [accounts, setAccounts] = useState<MetaAccount[]>([])
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [showAddAccount, setShowAddAccount] = useState(false)

  function loadAccounts() {
    api.meta.accounts().then((d: MetaAccount[]) => setAccounts(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => {
    api.get("/settings/platform").then(d => { setPlatform(d); if (d.meta_app_id) setForm(f => ({ ...f, meta_app_id: d.meta_app_id })) })
    api.meta.status().then(setMetaStatus).catch(() => setMetaStatus({ connected: false }))
    loadAccounts()
  }, [])

  useEffect(() => {
    const meta = searchParams.get("meta"), account = searchParams.get("account"), msg = searchParams.get("msg")
    if (meta === "connected") { setMetaMsg({ type: "ok", text: `Meta Ads conectado${account ? ` — ${account}` : ""}` }); api.meta.status().then(setMetaStatus) }
    else if (meta === "denied")  setMetaMsg({ type: "info", text: "Conexão cancelada." })
    else if (meta === "expired") setMetaMsg({ type: "err",  text: "Link expirado. Tente novamente." })
    else if (meta === "error")   setMetaMsg({ type: "err",  text: msg ? decodeURIComponent(msg) : "Erro ao conectar." })
  }, [searchParams])

  async function saveCreds() {
    setSaving(true); setError("")
    const payload: Record<string, string> = {}
    if (form.meta_app_id)     payload.meta_app_id = form.meta_app_id
    if (form.meta_app_secret) payload.meta_app_secret = form.meta_app_secret
    if (!Object.keys(payload).length) { setError("Preencha pelo menos um campo."); setSaving(false); return }
    try {
      await api.post("/settings/platform", payload)
      const u = await api.get("/settings/platform")
      setPlatform(u); if (u.meta_app_id) setForm(f => ({ ...f, meta_app_id: u.meta_app_id }))
      setForm(f => ({ ...f, meta_app_secret: "" }))
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  async function saveToken() {
    if (!manualToken.trim() || !manualAccount.trim()) return
    setSavingToken(true)
    try {
      await api.meta.saveToken(manualToken.trim(), manualAccount.trim())
      setMetaStatus(await api.meta.status())
      setMetaMsg({ type: "ok", text: "Token salvo com sucesso." })
      setManualToken(""); setManualAccount(""); setShowManual(false); setShowAddAccount(false)
      loadAccounts()
    } catch (e: any) { setMetaMsg({ type: "err", text: e.message }) } finally { setSavingToken(false) }
  }

  async function switchAccount(id: string) {
    setSwitchingId(id)
    try {
      await api.meta.switchAccount(id)
      setMetaStatus(await api.meta.status())
      loadAccounts()
    } catch (e: any) { setMetaMsg({ type: "err", text: e.message }) } finally { setSwitchingId(null) }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">Credenciais do App</h2>
        <p className="text-[12px] text-zinc-600 -mt-3">Necessário para autenticação OAuth com o Meta.</p>
        {error && <div className="text-[12px] text-red-400 bg-red-500/10 ring-1 ring-red-500/20 rounded-lg px-3 py-2">{error}</div>}
        <div className="space-y-3">
          <Field label="Meta App ID">
            <input type="text" placeholder={platform.meta_app_id || "1234567890"} value={form.meta_app_id} onChange={e => setForm(f => ({ ...f, meta_app_id: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Meta App Secret" badge={platform.meta_app_secret_set ? "configurado" : undefined}>
            <div className="relative">
              <input type={showSecret ? "text" : "password"} placeholder={platform.meta_app_secret_set ? "Deixe vazio para manter" : "App Secret"} value={form.meta_app_secret} onChange={e => setForm(f => ({ ...f, meta_app_secret: e.target.value }))} className={cn(inputCls, "pr-10")} />
              <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-3 top-2.5 text-zinc-600 hover:text-zinc-400">{showSecret ? <EyeOff size={13} /> : <Eye size={13} />}</button>
            </div>
          </Field>
        </div>
        <SaveBtn saving={saving} saved={saved} onClick={saveCreds} />
      </Card>

      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">Conexão da conta</h2>
        {metaMsg && <div className={cn("flex items-center gap-2 text-[12px] rounded-lg px-3 py-2 ring-1", metaMsg.type === "ok" ? "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20" : metaMsg.type === "err" ? "text-red-400 bg-red-500/10 ring-red-500/20" : "text-zinc-400 bg-white/[0.04] ring-white/[0.08]")}>{metaMsg.text}</div>}
        {metaStatus === null ? (
          <div className="flex items-center gap-2 text-zinc-600 text-[13px]"><Loader2 size={13} className="animate-spin" /> Verificando...</div>
        ) : metaStatus.connected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white/[0.03] ring-1 ring-white/[0.07] rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center"><LayoutGrid size={13} className="text-blue-400" /></div>
                <div>
                  <p className="text-[13px] font-medium text-zinc-200">Meta Ads conectado</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">Conta {metaStatus.ad_account_id}{metaStatus.connected_at ? ` · desde ${new Date(metaStatus.connected_at).toLocaleDateString("pt-BR")}` : ""}</p>
                </div>
              </div>
              <button onClick={async () => { if (!confirm("Desconectar?")) return; await api.meta.disconnect(); setMetaStatus({ connected: false }); setMetaMsg({ type: "info", text: "Conta desconectada." }) }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Unlink size={11} /> Desconectar</button>
            </div>
            <button onClick={() => setShowAddAccount(v => !v)} className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
              <Plus size={12} /> {showAddAccount ? "Cancelar" : "Conectar outra conta de anúncios"}
            </button>
            {showAddAccount && (
              <div className="space-y-2 pt-1">
                <Field label="Access Token"><input type="password" placeholder="EAAxxxxx..." value={manualToken} onChange={e => setManualToken(e.target.value)} className={inputCls} /></Field>
                <Field label="Ad Account ID"><input type="text" placeholder="act_123456789" value={manualAccount} onChange={e => setManualAccount(e.target.value)} className={inputCls} /></Field>
                <button onClick={saveToken} disabled={savingToken || !manualToken.trim() || !manualAccount.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-medium rounded-lg transition-colors">
                  {savingToken ? <><Loader2 size={13} className="animate-spin" /> Salvando...</> : "Salvar conta"}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {!platform.meta_app_id && <p className="text-[12px] text-amber-400">Configure o Meta App ID acima antes de conectar via OAuth.</p>}
            <button onClick={async () => { setConnecting(true); try { const { url } = await api.meta.connect(); window.open(url, "_blank") } catch (e: any) { setMetaMsg({ type: "err", text: e.message }) } finally { setConnecting(false) } }} disabled={connecting || !platform.meta_app_id} className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-900 text-[13px] font-semibold rounded-lg hover:bg-zinc-100 disabled:opacity-40 transition-colors">
              {connecting ? <><Loader2 size={13} className="animate-spin" /> Redirecionando...</> : <><Link2 size={13} /> Conectar via OAuth</>}
            </button>
            <div className="border-t border-white/[0.05] pt-3">
              <button onClick={() => setShowManual(v => !v)} className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">{showManual ? "▲ Ocultar" : "▼ Tenho um System User Token permanente"}</button>
              {showManual && (
                <div className="mt-3 space-y-2">
                  <Field label="Access Token"><input type="password" placeholder="EAAxxxxx..." value={manualToken} onChange={e => setManualToken(e.target.value)} className={inputCls} /></Field>
                  <Field label="Ad Account ID"><input type="text" placeholder="act_123456789" value={manualAccount} onChange={e => setManualAccount(e.target.value)} className={inputCls} /></Field>
                  <button onClick={saveToken} disabled={savingToken || !manualToken.trim() || !manualAccount.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-medium rounded-lg transition-colors">
                    {savingToken ? <><Loader2 size={13} className="animate-spin" /> Salvando...</> : "Salvar token"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {accounts.length >= 1 && (
        <Card>
          <h2 className="text-[13px] font-semibold text-zinc-200">Contas conectadas</h2>
          <p className="text-[12px] text-zinc-600 -mt-3">Selecione qual conta será usada para campanhas e insights.</p>
          <div className="space-y-1.5">
            {accounts.map(acc => (
              <div key={acc.id} className={cn("flex items-center justify-between px-4 py-3 rounded-lg ring-1 transition-colors",
                acc.is_active ? "bg-violet-500/10 ring-violet-500/30" : "bg-white/[0.02] ring-white/[0.06]"
              )}>
                <div className="flex items-center gap-3">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", acc.is_active ? "bg-violet-400" : "bg-zinc-600")} />
                  <div>
                    <p className="text-[13px] font-medium text-zinc-200">{acc.name || acc.ad_account_id}</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">{acc.ad_account_id} · {new Date(acc.created_at).toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>
                {!acc.is_active && (
                  <button onClick={() => switchAccount(acc.id)} disabled={!!switchingId}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors disabled:opacity-40">
                    {switchingId === acc.id ? <Loader2 size={11} className="animate-spin" /> : null}
                    Usar esta
                  </button>
                )}
                {acc.is_active && <span className="text-[11px] text-violet-400 font-medium">Ativa</span>}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ─── Tab: Alertas ─────────────────────────────────────────────────────────────

function AlertasTab() {
  const [configs, setConfigs] = useState<AlertCfg[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    api.get("/settings/alerts-config").then(d => { setConfigs(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  function toggle(type: string, field: "enabled", value: boolean): void
  function toggle(type: string, field: "channel", value: string): void
  function toggle(type: string, field: "enabled" | "channel", value: boolean | string) {
    setConfigs(prev => prev.map(c => {
      if (c.type !== type) return c
      if (field === "enabled") return { ...c, enabled: value as boolean }
      const ch = value as string
      const channels = c.channels.includes(ch) ? c.channels.filter(x => x !== ch) : [...c.channels, ch]
      return { ...c, channels }
    }))
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    try {
      await api.post("/settings/alerts-config", configs)
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  if (loading) return <div className="py-10 text-center text-zinc-600 text-[13px]">Carregando...</div>

  return (
    <div className="space-y-4 max-w-xl">
      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">Tipos de alerta</h2>
        <p className="text-[12px] text-zinc-600 -mt-3">Configure quais alertas receber e por quais canais.</p>
        <div className="space-y-1">
          {configs.map(c => (
            <div key={c.type} className={cn("rounded-lg border transition-colors", c.enabled ? "border-white/[0.07] bg-white/[0.02]" : "border-white/[0.04] bg-transparent opacity-60")}>
              <div className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-[13px] font-medium text-zinc-200">{c.label}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{c.description}</p>
                </div>
                <Toggle value={c.enabled} onChange={v => toggle(c.type, "enabled", v)} />
              </div>
              {c.enabled && (
                <div className="flex items-center gap-3 px-4 pb-3">
                  <span className="text-[11px] text-zinc-600">Canal:</span>
                  {[{ id: "in_app", label: "Sistema" }, { id: "whatsapp", label: "WhatsApp" }].map(ch => (
                    <button key={ch.id} onClick={() => toggle(c.type, "channel", ch.id)}
                      className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] ring-1 transition-colors",
                        c.channels.includes(ch.id) ? "bg-violet-500/15 ring-violet-500/30 text-violet-300" : "bg-white/[0.03] ring-white/[0.08] text-zinc-500 hover:text-zinc-300"
                      )}>
                      {c.channels.includes(ch.id) && <Check size={9} />}
                      {ch.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <SaveBtn saving={saving} saved={saved} onClick={save} />
      </Card>
    </div>
  )
}

// ─── Tab: WhatsApp ────────────────────────────────────────────────────────────

function WhatsAppTab() {
  const [cfg, setCfg] = useState({ provider: "", uazapi_url: "", uazapi_key: "", uazapi_instance: "", official_token: "", official_phone_id: "", whatsapp_number: "", alerts_whatsapp_enabled: false, qr: null as string | null, connected: false })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [refreshingQr, setRefreshingQr] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  async function load() {
    const d = await api.get("/settings/whatsapp").catch(() => null)
    if (d) setCfg(prev => ({ ...prev, ...d }))
    setLoading(false)
  }

  useEffect(() => {
    load()
    return () => clearInterval(pollRef.current)
  }, [])

  useEffect(() => {
    if (cfg.provider === "uazapi" && cfg.qr && !cfg.connected) {
      pollRef.current = setInterval(async () => {
        const d = await api.get("/settings/whatsapp").catch(() => null)
        if (d?.connected) { setCfg(prev => ({ ...prev, connected: true, qr: null })); clearInterval(pollRef.current) }
      }, 4000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [cfg.provider, cfg.qr, cfg.connected])

  async function save() {
    setSaving(true)
    try {
      await api.post("/settings/whatsapp", { provider: cfg.provider, uazapi_url: cfg.uazapi_url, uazapi_key: cfg.uazapi_key, uazapi_instance: cfg.uazapi_instance, official_token: cfg.official_token, official_phone_id: cfg.official_phone_id, whatsapp_number: cfg.whatsapp_number, alerts_whatsapp_enabled: cfg.alerts_whatsapp_enabled })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
      load()
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  async function refreshQr() {
    setRefreshingQr(true)
    await save()
    setRefreshingQr(false)
  }

  if (loading) return <div className="py-10 text-center text-zinc-600 text-[13px]">Carregando...</div>

  return (
    <div className="space-y-4 max-w-xl">
      {/* Provider */}
      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">Número GTPRO</h2>
        <p className="text-[12px] text-zinc-600 -mt-3">Número de envio único para todos os clientes. Configure uma vez, todos recebem.</p>

        <div className="grid grid-cols-2 gap-2">
          {[{ id: "uazapi", label: "UazAPI", desc: "QR Code" }, { id: "official", label: "API Oficial Meta", desc: "WABA" }].map(p => (
            <button key={p.id} onClick={() => setCfg(c => ({ ...c, provider: p.id }))}
              className={cn("flex flex-col items-start px-4 py-3 rounded-xl ring-1 transition-all text-left", cfg.provider === p.id ? "bg-violet-500/10 ring-violet-500/30 text-white" : "bg-white/[0.02] ring-white/[0.07] text-zinc-500 hover:text-zinc-300")}>
              <span className="text-[13px] font-medium">{p.label}</span>
              <span className="text-[11px] opacity-60 mt-0.5">{p.desc}</span>
            </button>
          ))}
        </div>

        {cfg.provider === "uazapi" && (
          <div className="space-y-3">
            <Field label="URL da instância"><input type="url" placeholder="https://api.uazapi.com" value={cfg.uazapi_url} onChange={e => setCfg(c => ({ ...c, uazapi_url: e.target.value }))} className={inputCls} /></Field>
            <Field label="API Key"><input type="password" placeholder="sua-api-key" value={cfg.uazapi_key} onChange={e => setCfg(c => ({ ...c, uazapi_key: e.target.value }))} className={inputCls} /></Field>
            <Field label="Nome da instância"><input type="text" placeholder="gtpro-alertas" value={cfg.uazapi_instance} onChange={e => setCfg(c => ({ ...c, uazapi_instance: e.target.value }))} className={inputCls} /></Field>

            {cfg.connected ? (
              <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-xl">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[13px] font-medium text-emerald-300">WhatsApp conectado</span>
              </div>
            ) : cfg.qr ? (
              <div className="flex flex-col items-center gap-3 py-2">
                <p className="text-[12px] text-zinc-500">Escaneie o QR Code com o WhatsApp do número GTPRO</p>
                <div className="bg-white p-3 rounded-xl">
                  <img src={cfg.qr} alt="QR Code WhatsApp" className="w-48 h-48" />
                </div>
                <button onClick={refreshQr} disabled={refreshingQr} className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
                  <RotateCcw size={11} className={refreshingQr ? "animate-spin" : ""} /> Atualizar QR
                </button>
              </div>
            ) : null}
          </div>
        )}

        {cfg.provider === "official" && (
          <div className="space-y-3">
            <Field label="Access Token"><input type="password" placeholder="EAAxxxxx..." value={cfg.official_token} onChange={e => setCfg(c => ({ ...c, official_token: e.target.value }))} className={inputCls} /></Field>
            <Field label="Phone Number ID"><input type="text" placeholder="123456789012345" value={cfg.official_phone_id} onChange={e => setCfg(c => ({ ...c, official_phone_id: e.target.value }))} className={inputCls} /></Field>
          </div>
        )}

        {cfg.provider && <SaveBtn saving={saving} saved={saved} onClick={save} label={cfg.provider === "uazapi" && !cfg.connected ? "Salvar e gerar QR" : "Salvar"} />}
      </Card>

      {/* Tenant number */}
      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">Meu número para alertas</h2>
        <p className="text-[12px] text-zinc-600 -mt-3">Número que receberá as notificações desta conta. Inclua o DDI.</p>
        <Field label="WhatsApp (ex: 5511999999999)">
          <div className="flex items-center gap-2 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg px-3 py-2.5">
            <Smartphone size={13} className="text-zinc-600 shrink-0" />
            <input type="tel" placeholder="5511999999999" value={cfg.whatsapp_number} onChange={e => setCfg(c => ({ ...c, whatsapp_number: e.target.value }))} className="flex-1 bg-transparent text-[13px] text-white placeholder-zinc-600 focus:outline-none" />
          </div>
        </Field>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-zinc-200">Notificações ativas</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Receber alertas por WhatsApp</p>
          </div>
          <Toggle value={cfg.alerts_whatsapp_enabled} onChange={v => { setCfg(c => ({ ...c, alerts_whatsapp_enabled: v })); setSaved(false) }} />
        </div>
        <SaveBtn saving={saving} saved={saved} onClick={save} />
      </Card>
    </div>
  )
}

// ─── Tab: Skills ──────────────────────────────────────────────────────────────

const SKILL_COLOR_OPTIONS = ["violet", "blue", "emerald", "amber", "red"]

function SkillsTab() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const [newSkill, setNewSkill] = useState({ name: "", prompt: "", icon: "Zap", color: "violet" })
  const [addingSkill, setAddingSkill] = useState(false)
  const [savingSkill, setSavingSkill] = useState(false)

  useEffect(() => {
    api.skills.list().then(d => setSkills(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  async function saveSkill() {
    if (!newSkill.name.trim() || !newSkill.prompt.trim()) return
    setSavingSkill(true)
    try { const d = await api.skills.create(newSkill); setSkills(p => [...p, d]); setNewSkill({ name: "", prompt: "", icon: "Zap", color: "violet" }); setAddingSkill(false) }
    catch (e: any) { alert(e.message) } finally { setSavingSkill(false) }
  }

  async function updateSkill() {
    if (!editingSkill) return
    setSavingSkill(true)
    try { const d = await api.skills.update(editingSkill.id, { name: editingSkill.name, prompt: editingSkill.prompt }); setSkills(p => p.map(s => s.id === d.id ? d : s)); setEditingSkill(null) }
    catch (e: any) { alert(e.message) } finally { setSavingSkill(false) }
  }

  async function deleteSkill(id: string) {
    if (!confirm("Deletar esta skill?")) return
    await api.skills.delete(id); setSkills(p => p.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-4 max-w-xl">
      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">Skills do agente</h2>
        <p className="text-[12px] text-zinc-600 -mt-3">Atalhos de prompt no chat. Personalize o contexto para o seu nicho.</p>
        <div className="space-y-2">
          {skills.map(skill => (
            <div key={skill.id} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-lg overflow-hidden">
              {editingSkill?.id === skill.id ? (
                <div className="p-4 space-y-3">
                  <input value={editingSkill.name} onChange={e => setEditingSkill(s => s ? { ...s, name: e.target.value } : s)} className={cn(inputCls, "text-[12px]")} placeholder="Nome da skill" />
                  <textarea value={editingSkill.prompt} onChange={e => setEditingSkill(s => s ? { ...s, prompt: e.target.value } : s)} rows={5} className={cn(inputCls, "text-[12px] resize-none leading-relaxed")} />
                  <div className="flex gap-2">
                    <button onClick={updateSkill} disabled={savingSkill} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[12px] font-medium rounded-lg transition-colors">{savingSkill ? "Salvando..." : "Salvar"}</button>
                    <button onClick={() => setEditingSkill(null)} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-[12px] transition-colors">Cancelar</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[13px] font-medium text-zinc-200">{skill.name}</p>
                      {!skill.tenant_id && <span className="text-[10px] text-zinc-600 bg-white/[0.04] px-1.5 py-0.5 rounded">plataforma</span>}
                    </div>
                    <p className="text-[11px] text-zinc-600 mt-1 truncate">{skill.prompt.slice(0, 90)}…</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {skill.tenant_id ? (
                      <>
                        <button onClick={() => setEditingSkill(skill)} className="w-7 h-7 flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-colors"><Pencil size={12} className="text-zinc-500" /></button>
                        <button onClick={() => deleteSkill(skill.id)} className="w-7 h-7 flex items-center justify-center hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={12} className="text-zinc-600 hover:text-red-400" /></button>
                      </>
                    ) : (
                      <button onClick={() => setEditingSkill({ ...skill, tenant_id: "pending" })} className="flex items-center gap-1 px-2 py-1 text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.05] rounded-lg transition-colors"><Pencil size={10} /> Personalizar</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {addingSkill ? (
          <div className="bg-white/[0.02] ring-1 ring-white/[0.07] rounded-lg p-4 space-y-3">
            <input value={newSkill.name} onChange={e => setNewSkill(s => ({ ...s, name: e.target.value }))} className={cn(inputCls, "text-[12px]")} placeholder="Nome (ex: Revisar copy de produto)" />
            <textarea value={newSkill.prompt} onChange={e => setNewSkill(s => ({ ...s, prompt: e.target.value }))} rows={5} className={cn(inputCls, "text-[12px] resize-none leading-relaxed")} placeholder="Prompt enviado ao agente..." />
            <div className="flex gap-2">
              <button onClick={saveSkill} disabled={savingSkill || !newSkill.name.trim() || !newSkill.prompt.trim()} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[12px] font-medium rounded-lg transition-colors">{savingSkill ? "Criando..." : "Criar"}</button>
              <button onClick={() => setAddingSkill(false)} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-[12px] transition-colors">Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setAddingSkill(true)} className="flex items-center gap-1.5 px-3 py-2 text-[12px] text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04] ring-1 ring-white/[0.06] rounded-lg transition-colors w-full justify-center">
            <Plus size={12} /> Nova skill
          </button>
        )}
      </Card>
    </div>
  )
}

// ─── Tab: Plataforma ──────────────────────────────────────────────────────────

function PlataformaTab() {
  const [platform, setPlatform] = useState({ anthropic_api_key_set: false })
  const [anthropicKey, setAnthropicKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState("")
  const [generatedKey, setGeneratedKey] = useState("")
  const [copiedKey, setCopiedKey] = useState(false)
  const [creatingKey, setCreatingKey] = useState(false)

  useEffect(() => {
    api.get("/settings/platform").then(setPlatform)
    api.get("/settings/api-keys").then(d => setApiKeys(Array.isArray(d) ? d : []))
  }, [])

  async function saveAnthropicKey() {
    if (!anthropicKey.trim()) return
    setSaving(true); setError("")
    try {
      await api.post("/settings/platform", { anthropic_api_key: anthropicKey })
      setPlatform(await api.get("/settings/platform"))
      setAnthropicKey(""); setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { setError(e.message) } finally { setSaving(false) }
  }

  async function createApiKey() {
    if (!newKeyName.trim()) return
    setCreatingKey(true)
    const result = await api.post(`/settings/api-keys?name=${encodeURIComponent(newKeyName)}&scope=read_write`, null)
    setGeneratedKey(result.key); setApiKeys(p => [...p, result]); setNewKeyName(""); setCreatingKey(false)
  }

  function copyKey(key: string) { navigator.clipboard.writeText(key); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000) }

  return (
    <div className="space-y-4 max-w-xl">
      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">Anthropic API Key</h2>
        <p className="text-[12px] text-zinc-600 -mt-3">Chave para o agente IA funcionar.</p>
        {error && <div className="text-[12px] text-red-400 bg-red-500/10 ring-1 ring-red-500/20 rounded-lg px-3 py-2">{error}</div>}
        <Field label="API Key" badge={platform.anthropic_api_key_set ? "configurada" : undefined}>
          <div className="relative">
            <input type={showKey ? "text" : "password"} placeholder={platform.anthropic_api_key_set ? "Deixe vazio para manter" : "sk-ant-..."} value={anthropicKey} onChange={e => setAnthropicKey(e.target.value)} className={cn(inputCls, "pr-10")} />
            <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-2.5 text-zinc-600 hover:text-zinc-400">{showKey ? <EyeOff size={13} /> : <Eye size={13} />}</button>
          </div>
        </Field>
        <SaveBtn saving={saving} saved={saved} onClick={saveAnthropicKey} />
      </Card>

      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">API Keys externas</h2>
        <p className="text-[12px] text-zinc-600 -mt-3">Para conectar outros sistemas ao GTPRO.</p>
        {generatedKey && (
          <div className="bg-emerald-500/[0.08] ring-1 ring-emerald-500/20 rounded-lg p-4">
            <p className="text-[11px] text-emerald-500 mb-2 font-medium">Copie agora — não será exibida novamente</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] text-emerald-300 bg-black/20 px-3 py-2 rounded-md truncate">{generatedKey}</code>
              <button onClick={() => copyKey(generatedKey)} className="shrink-0 w-8 h-8 flex items-center justify-center bg-white/[0.06] hover:bg-white/[0.10] rounded-lg transition-colors">
                {copiedKey ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} className="text-zinc-400" />}
              </button>
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <input placeholder="Nome (ex: Nexio CRM)" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} onKeyDown={e => e.key === "Enter" && createApiKey()} className={cn(inputCls, "flex-1")} />
          <button onClick={createApiKey} disabled={creatingKey || !newKeyName.trim()} className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.06] ring-1 ring-white/[0.08] hover:bg-white/[0.09] disabled:opacity-40 text-white text-[13px] font-medium rounded-lg transition-colors">
            <Plus size={13} /> Gerar
          </button>
        </div>
        {apiKeys.length > 0 && (
          <div className="divide-y divide-white/[0.05] ring-1 ring-white/[0.06] rounded-lg overflow-hidden">
            {apiKeys.map(key => (
              <div key={key.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-[13px] text-zinc-200">{key.name}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{key.scope} · {new Date(key.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <button onClick={() => { api.post(`/settings/api-keys/${key.id}`, null); setApiKeys(p => p.filter(k => k.id !== key.id)) }} className="w-7 h-7 flex items-center justify-center hover:bg-red-500/10 rounded-lg transition-colors">
                  <Trash2 size={13} className="text-zinc-600 hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabId = "agente" | "meta" | "alertas" | "whatsapp" | "skills" | "plataforma"

function ConfiguracoesContent() {
  const [tab, setTab] = useState<TabId>("agente")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[17px] font-semibold text-white">Configurações</h1>
        <p className="text-[12px] text-zinc-600 mt-0.5">Gerencie integrações, agente e preferências da conta</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] overflow-x-auto">
        {TABS.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setTab(t.id as TabId)}
              className={cn("flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
                tab === t.id ? "border-violet-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}>
              <Icon size={12} />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "agente"     && <AgenteTab />}
      {tab === "meta"       && <MetaTab />}
      {tab === "alertas"    && <AlertasTab />}
      {tab === "whatsapp"   && <WhatsAppTab />}
      {tab === "skills"     && <SkillsTab />}
      {tab === "plataforma" && <PlataformaTab />}
    </div>
  )
}

export default function ConfiguracoesPage() {
  return <Suspense><ConfiguracoesContent /></Suspense>
}
