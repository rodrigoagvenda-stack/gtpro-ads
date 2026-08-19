"use client"

import { useEffect, useState, Suspense, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import {
  Check, Copy, Eye, EyeOff, Plus, Trash2, RefreshCw, Link2, Unlink,
  Loader2, LayoutGrid, Pencil, Bot, Megaphone, Bell, MessageCircle,
  Zap, Key, Settings, Settings2, Smartphone, RotateCcw, Users, Shield, UserMinus,
  Mail, X, ExternalLink, TrendingUp, ChevronDown,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ApiKey { id: string; name: string; scope: string; ad_account_ids: string[] | null; active: boolean; created_at: string }
interface MetaAccount { id: string; ad_account_id: string; name: string; is_active: boolean }
interface Skill  { id: string; name: string; icon: string; color: string; prompt: string; is_default: boolean; tenant_id: string | null }
interface AlertCfg { type: string; label: string; description: string; enabled: boolean; channels: string[] }
interface Member { id: string; email: string; name: string; role: string; created_at: string }
interface PendingInvite { id: string; email: string; role: string; expires_at: string; created_at: string }

const OBJETIVOS = [
  { value: "LEADS",       label: "Geração de Leads" },
  { value: "SALES",       label: "Vendas / E-commerce" },
  { value: "TRAFFIC",     label: "Tráfego" },
  { value: "AWARENESS",   label: "Reconhecimento" },
  { value: "APP_INSTALLS",label: "Instalações de app" },
]

const TABS = [
  { id: "agente",     label: "Agente",      icon: Bot },
  { id: "meta",       label: "Meta Ads",    icon: Megaphone },
  { id: "google",     label: "Google Ads",  icon: TrendingUp },
  { id: "alertas",    label: "Alertas",     icon: Bell },
  { id: "whatsapp",   label: "WhatsApp",    icon: MessageCircle },
  { id: "skills",     label: "Skills",      icon: Zap },
  { id: "equipe",     label: "Equipe",      icon: Users },
  { id: "api",        label: "API",         icon: Key },
  { id: "plataforma", label: "Plataforma",  icon: Settings },
]

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Membro",
}

const ROLE_OPTIONS = [
  { value: "admin",  label: "Admin" },
  { value: "member", label: "Membro" },
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

function Select({ value, onChange, options }: { value: string | number; onChange: (v: string) => void; options: { value: string | number; label: string }[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = options.find(o => String(o.value) === String(value))

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [open])

  return (
    <div ref={ref} className="relative w-full">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg text-[13px] text-white focus:outline-none focus:ring-violet-500/50 transition-all text-left">
        <span>{current?.label ?? "—"}</span>
        <svg className={cn("w-3.5 h-3.5 text-zinc-500 transition-transform shrink-0", open && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-zinc-900 ring-1 ring-white/[0.1] rounded-lg overflow-hidden shadow-xl">
          {options.map(o => (
            <button key={o.value} type="button"
              onClick={() => { onChange(String(o.value)); setOpen(false) }}
              className={cn("w-full text-left px-3.5 py-2.5 text-[13px] transition-colors", String(o.value) === String(value) ? "bg-violet-500/20 text-violet-200" : "text-zinc-300 hover:bg-white/[0.06]")}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Agente ──────────────────────────────────────────────────────────────

function AgenteTab() {
  const [cfg, setCfg] = useState({
    objetivo_principal: "LEADS", roas_minimo: 2, cpl_maximo: 50, budget_mensal: "",
    modo_supervisionado: true, limite_budget_sem_aprovacao: 100,
    campaign_naming_template: "", business_profile: "",
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved]   = useState(false)

  useEffect(() => {
    api.tenant.get().then(d => setCfg({
      objetivo_principal: d.objetivo_principal ?? "LEADS",
      roas_minimo: d.roas_minimo ?? 2,
      cpl_maximo: d.cpl_maximo ?? 50,
      budget_mensal: d.budget_mensal ?? "",
      modo_supervisionado: d.modo_supervisionado ?? true,
      limite_budget_sem_aprovacao: d.limite_budget_sem_aprovacao ?? 100,
      campaign_naming_template: d.campaign_naming_template ?? "",
      business_profile: d.business_profile ?? "",
    })).catch(() => {})
  }, [])

  async function save() {
    setSaving(true)
    try {
      await api.tenant.save({
        ...cfg,
        roas_minimo: Number(cfg.roas_minimo),
        cpl_maximo: Number(cfg.cpl_maximo),
        budget_mensal: cfg.budget_mensal ? Number(cfg.budget_mensal) : null,
        limite_budget_sem_aprovacao: Number(cfg.limite_budget_sem_aprovacao),
      })
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { alert(e.message) } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">Perfil do negócio</h2>
        <p className="text-[12px] text-zinc-600 -mt-3">
          Contexto fixo que o agente sempre tem disponível, sem depender do histórico da conversa: o que o cliente vende, público-alvo, ticket médio, diferenciais. Mantenha objetivo e curto.
        </p>
        <Field label="Resumo do negócio">
          <textarea
            rows={5}
            placeholder="Ex: Clínica odontológica em Curitiba, foco em implantes e ortodontia. Público: 30-55 anos, classe B/C. Ticket médio R$3.500. Diferencial: parcelamento em 24x sem juros."
            value={cfg.business_profile}
            onChange={e => setCfg(c => ({ ...c, business_profile: e.target.value }))}
            className={cn(inputCls, "resize-none")}
          />
        </Field>
        <SaveBtn saving={saving} saved={saved} onClick={save} />
      </Card>

      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">Parâmetros de performance</h2>
        <p className="text-[12px] text-zinc-600 -mt-3">Valores que o agente usa para avaliar campanhas e tomar decisões.</p>
        <div className="space-y-3">
          <Field label="Objetivo principal">
            <Select value={cfg.objetivo_principal} onChange={v => setCfg(c => ({ ...c, objetivo_principal: v }))} options={OBJETIVOS} />
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
        <h2 className="text-[13px] font-semibold text-zinc-200">Nomenclatura de campanhas</h2>
        <p className="text-[12px] text-zinc-600 -mt-3">
          Padrão que o agente seguirá ao criar campanhas. Use variáveis entre colchetes.
        </p>
        <Field label="Template de nome">
          <input
            type="text"
            placeholder="Ex: [Objetivo] | [Público] | [Criativo] | [Data]"
            value={cfg.campaign_naming_template}
            onChange={e => setCfg(c => ({ ...c, campaign_naming_template: e.target.value }))}
            className={inputCls}
          />
        </Field>
        <div className="bg-white/[0.02] rounded-lg px-3 py-2.5 space-y-1">
          <p className="text-[11px] text-zinc-600 font-medium">Variáveis sugeridas:</p>
          <div className="flex flex-wrap gap-1.5">
            {["[Objetivo]","[Público]","[Criativo]","[Formato]","[Data]","[Nicho]","[Funil]"].map(v => (
              <button key={v} onClick={() => setCfg(c => ({ ...c, campaign_naming_template: c.campaign_naming_template + v }))}
                className="px-2 py-0.5 bg-violet-500/10 ring-1 ring-violet-500/20 rounded text-[11px] text-violet-300 hover:bg-violet-500/20 transition-colors font-mono">
                {v}
              </button>
            ))}
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

interface MetaAccount { id: string; ad_account_id: string; name: string; is_active: boolean; created_at: string; pixel_id: string | null }

function AccountRenameRow({ acc, onRenamed }: { acc: MetaAccount; onRenamed: () => void }) {
  const [editingName, setEditingName]   = useState(false)
  const [editingPixel, setEditingPixel] = useState(false)
  const [name, setName]                 = useState(acc.name || "")
  const [pixelId, setPixelId]           = useState(acc.pixel_id || "")
  const [saving, setSaving]             = useState(false)

  async function saveName() {
    if (!name.trim()) return
    setSaving(true)
    try { await api.meta.renameAccount(acc.id, name.trim()); onRenamed(); setEditingName(false) }
    catch {} finally { setSaving(false) }
  }

  async function savePixel() {
    setSaving(true)
    try {
      await api.patch(`/meta/accounts/${acc.id}`, { pixel_id: pixelId.trim() || null })
      onRenamed(); setEditingPixel(false)
    } catch {} finally { setSaving(false) }
  }

  return (
    <div className={cn("px-4 py-3 rounded-lg ring-1 transition-colors space-y-2",
      acc.is_active ? "bg-violet-500/10 ring-violet-500/30" : "bg-white/[0.02] ring-white/[0.06]"
    )}>
      {/* Name row */}
      <div className="flex items-center gap-3">
        <div className={cn("w-2 h-2 rounded-full shrink-0", acc.is_active ? "bg-violet-400" : "bg-zinc-600")} />
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input autoFocus value={name} onChange={e => setName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveName(); if (e.key === "Escape") setEditingName(false) }}
                maxLength={20} placeholder="Até 20 caracteres"
                className="flex-1 bg-white/[0.06] ring-1 ring-violet-500/50 rounded-md px-2.5 py-1 text-[12px] text-white focus:outline-none" />
              <button onClick={saveName} disabled={saving} className="px-2.5 py-1 text-[11px] bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-md">{saving ? "..." : "OK"}</button>
              <button onClick={() => setEditingName(false)} className="px-2.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-300">✕</button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <div>
                <p className="text-[13px] font-medium text-zinc-200">{acc.name || <span className="text-zinc-600 italic">sem nome</span>}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">{acc.ad_account_id} · {new Date(acc.created_at).toLocaleDateString("pt-BR")}</p>
              </div>
              <button onClick={() => { setName(acc.name || ""); setEditingName(true) }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/[0.06] rounded-md">
                <Pencil size={11} className="text-zinc-500" />
              </button>
            </div>
          )}
        </div>
        {acc.is_active && <span className="text-[11px] text-violet-400 font-medium shrink-0">Ativa</span>}
      </div>

      {/* Pixel ID row */}
      <div className="pl-5">
        {editingPixel ? (
          <div className="flex items-center gap-2">
            <input autoFocus value={pixelId} onChange={e => setPixelId(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") savePixel(); if (e.key === "Escape") setEditingPixel(false) }}
              placeholder="Ex: 1234567890123456"
              className="flex-1 bg-white/[0.06] ring-1 ring-violet-500/50 rounded-md px-2.5 py-1 text-[12px] text-white font-mono focus:outline-none" />
            <button onClick={savePixel} disabled={saving} className="px-2.5 py-1 text-[11px] bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-md">{saving ? "..." : "OK"}</button>
            <button onClick={() => setEditingPixel(false)} className="px-2.5 py-1 text-[11px] text-zinc-500 hover:text-zinc-300">✕</button>
          </div>
        ) : (
          <button onClick={() => { setPixelId(acc.pixel_id || ""); setEditingPixel(true) }}
            className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-300 transition-colors group">
            <Key size={10} />
            {acc.pixel_id
              ? <span className="font-mono text-zinc-400">{acc.pixel_id}</span>
              : <span className="italic">Pixel ID não configurado</span>}
            <Pencil size={9} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        )}
      </div>
    </div>
  )
}

function MetaTab() {
  const searchParams = useSearchParams()
  const [isAdmin, setIsAdmin] = useState(false)
  const [platform, setPlatform] = useState({ anthropic_api_key_set: false, meta_app_id: "", meta_app_secret_set: false })
  const [form, setForm] = useState({ meta_app_id: "", meta_app_secret: "" })
  const [showSecret, setShowSecret] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const [metaStatus, setMetaStatus] = useState<{ connected: boolean; ad_account_id?: string; connected_at?: string; token_expires_soon?: boolean; token_days_remaining?: number | null } | null>(null)
  const [connecting, setConnecting] = useState(false)
  const [metaMsg, setMetaMsg] = useState<{ type: "ok"|"err"|"info"; text: string } | null>(null)
  const [manualToken, setManualToken] = useState("")
  const [manualAccount, setManualAccount] = useState("")
  const [savingToken, setSavingToken] = useState(false)
  const [showManual, setShowManual] = useState(false)
  const [accounts, setAccounts] = useState<MetaAccount[]>([])
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showSelectModal, setShowSelectModal] = useState(false)
  const [selectList, setSelectList] = useState<(MetaAccount & { checked: boolean })[]>([])
  const [confirming, setConfirming] = useState(false)

  function loadAccounts() {
    api.meta.accounts().then((d: MetaAccount[]) => setAccounts(Array.isArray(d) ? d : [])).catch(() => {})
  }

  async function removeAccount(acc: MetaAccount) {
    if (!confirm(`Remover "${acc.name || acc.ad_account_id}" desta empresa?`)) return
    setRemovingId(acc.id)
    try {
      await api.delete(`/meta/accounts/${acc.id}`)
      loadAccounts()
    } catch (e: any) {
      alert(e.message || "Erro ao remover conta.")
    } finally { setRemovingId(null) }
  }

  useEffect(() => {
    api.get("/auth/me").then(me => { if (me?.is_admin) setIsAdmin(true) }).catch(() => {})
    api.get("/settings/platform").then(d => { setPlatform(d); if (d.meta_app_id) setForm(f => ({ ...f, meta_app_id: d.meta_app_id })) })
    api.meta.status().then(setMetaStatus).catch(() => setMetaStatus({ connected: false }))
    loadAccounts()
  }, [])

  useEffect(() => {
    const meta = searchParams.get("meta"), account = searchParams.get("account"), msg = searchParams.get("msg")
    if (meta === "select") {
      api.meta.status().then(setMetaStatus)
      api.meta.accounts().then((accs: MetaAccount[]) => {
        setSelectList(accs.map(a => ({ ...a, checked: true })))
        setShowSelectModal(true)
      }).catch(() => {})
    }
    else if (meta === "connected") { setMetaMsg({ type: "ok", text: `Meta Ads conectado${account ? ` — ${account}` : ""}` }); api.meta.status().then(setMetaStatus) }
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
      setMetaMsg({ type: "ok", text: "Conta ativada. Recarregando..." })
      setTimeout(() => window.location.reload(), 900)
    } catch (e: any) {
      setMetaMsg({ type: "err", text: e.message })
      setSwitchingId(null)
    }
  }

  async function confirmSelection() {
    setConfirming(true)
    const toRemove = selectList.filter(a => !a.checked && !a.is_active)
    for (const acc of toRemove) {
      try { await api.delete(`/meta/accounts/${acc.id}`) } catch {}
    }
    setShowSelectModal(false)
    loadAccounts()
    api.meta.status().then(setMetaStatus)
    const kept = selectList.filter(a => a.checked).length
    setMetaMsg({ type: "ok", text: `${kept} conta(s) salva(s) com sucesso.` })
    setConfirming(false)
  }

  return (
    <div className="space-y-4 max-w-xl">
      {showSelectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#111113] ring-1 ring-white/[0.08] rounded-2xl flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06]">
              <div>
                <h3 className="text-[14px] font-semibold text-white">Selecione as contas</h3>
                <p className="text-[12px] text-zinc-500 mt-0.5">Desmarque as contas que não deseja manter no GTPRO</p>
              </div>
              <button onClick={() => setShowSelectModal(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-3 space-y-1">
              {selectList.map(acc => (
                <label key={acc.id} className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors", acc.checked ? "bg-violet-500/10" : "hover:bg-white/[0.03]")}>
                  <input
                    type="checkbox"
                    checked={acc.checked}
                    disabled={acc.is_active}
                    onChange={e => setSelectList(prev => prev.map(a => a.id === acc.id ? { ...a, checked: e.target.checked } : a))}
                    className="w-4 h-4 accent-violet-500 shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-zinc-200 truncate">{acc.name || <span className="italic text-zinc-600">sem nome</span>}</p>
                    <p className="text-[11px] text-zinc-600 font-mono">{acc.ad_account_id}</p>
                  </div>
                  {acc.is_active && <span className="text-[10px] text-violet-400 font-medium shrink-0">ativa</span>}
                </label>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-white/[0.06] flex items-center justify-between gap-3">
              <p className="text-[12px] text-zinc-500">{selectList.filter(a => a.checked).length} de {selectList.length} selecionadas</p>
              <button onClick={confirmSelection} disabled={confirming} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-colors">
                {confirming ? <><Loader2 size={13} className="animate-spin" /> Salvando...</> : "Confirmar seleção"}
              </button>
            </div>
          </div>
        </div>
      )}
      {isAdmin && (
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
      )}

      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">Conexão da conta</h2>
        {metaMsg && <div className={cn("flex items-center gap-2 text-[12px] rounded-lg px-3 py-2 ring-1", metaMsg.type === "ok" ? "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20" : metaMsg.type === "err" ? "text-red-400 bg-red-500/10 ring-red-500/20" : "text-zinc-400 bg-white/[0.04] ring-white/[0.08]")}>{metaMsg.text}</div>}
        {metaStatus === null ? (
          <div className="flex items-center gap-2 text-zinc-600 text-[13px]"><Loader2 size={13} className="animate-spin" /> Verificando...</div>
        ) : metaStatus.connected ? (
          <div className="space-y-3">
            {metaStatus.token_expires_soon && (
              <div className="flex items-center gap-2 text-[12px] text-amber-400 bg-amber-500/10 ring-1 ring-amber-500/20 rounded-lg px-3 py-2">
                ⚠️ Token expira em {metaStatus.token_days_remaining ?? "?"} dias — reconecte a conta para não perder acesso.
              </div>
            )}
            <div className="flex items-center justify-between bg-white/[0.03] ring-1 ring-white/[0.07] rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center"><LayoutGrid size={13} className="text-blue-400" /></div>
                <div>
                  <p className="text-[13px] font-medium text-zinc-200">Meta Ads conectado</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">Conta {metaStatus.ad_account_id}{metaStatus.connected_at ? ` · desde ${new Date(metaStatus.connected_at).toLocaleDateString("pt-BR")}` : ""}{metaStatus.token_days_remaining != null && !metaStatus.token_expires_soon ? ` · token expira em ${metaStatus.token_days_remaining}d` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={async () => { setConnecting(true); try { const { url } = await api.meta.connect(); window.open(url, "_blank") } catch (e: any) { setMetaMsg({ type: "err", text: e.message }) } finally { setConnecting(false) } }} disabled={connecting} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors disabled:opacity-40">
                  {connecting ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} Reconectar
                </button>
                <button onClick={async () => { if (!confirm("Desconectar?")) return; await api.meta.disconnect(); setMetaStatus({ connected: false }); setMetaMsg({ type: "info", text: "Conta desconectada." }) }} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Unlink size={11} /> Desconectar</button>
              </div>
            </div>
            <button onClick={() => setShowAddAccount(v => !v)} className="flex items-center gap-1.5 text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
              <Plus size={12} /> {showAddAccount ? "Cancelar" : "Conectar outra conta de anúncios"}
            </button>
            {showAddAccount && (
              <div className="space-y-3 pt-1">
                <button onClick={async () => { setConnecting(true); try { const { url } = await api.meta.connect(); window.open(url, "_blank") } catch (e: any) { setMetaMsg({ type: "err", text: e.message }) } finally { setConnecting(false) } }} disabled={connecting || (isAdmin && !platform.meta_app_id)} className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-900 text-[13px] font-semibold rounded-lg hover:bg-zinc-100 disabled:opacity-40 transition-colors">
                  {connecting ? <><Loader2 size={13} className="animate-spin" /> Redirecionando...</> : <><Link2 size={13} /> Conectar via OAuth</>}
                </button>
                <button onClick={() => setShowManual(v => !v)} className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">{showManual ? "▲ Ocultar" : "▼ Tenho um System User Token permanente"}</button>
                {showManual && (
                  <div className="space-y-2">
                    <Field label="Access Token"><input type="password" placeholder="EAAxxxxx..." value={manualToken} onChange={e => setManualToken(e.target.value)} className={inputCls} /></Field>
                    <Field label="Ad Account ID"><input type="text" placeholder="act_123456789" value={manualAccount} onChange={e => setManualAccount(e.target.value)} className={inputCls} /></Field>
                    <button onClick={saveToken} disabled={savingToken || !manualToken.trim() || !manualAccount.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-medium rounded-lg transition-colors">
                      {savingToken ? <><Loader2 size={13} className="animate-spin" /> Salvando...</> : "Salvar conta"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {isAdmin && !platform.meta_app_id && <p className="text-[12px] text-amber-400">Configure o Meta App ID acima antes de conectar via OAuth.</p>}
            <button onClick={async () => { setConnecting(true); try { const { url } = await api.meta.connect(); window.open(url, "_blank") } catch (e: any) { setMetaMsg({ type: "err", text: e.message }) } finally { setConnecting(false) } }} disabled={connecting || (isAdmin && !platform.meta_app_id)} className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-900 text-[13px] font-semibold rounded-lg hover:bg-zinc-100 disabled:opacity-40 transition-colors">
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
              <div key={acc.id} className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <AccountRenameRow acc={acc} onRenamed={loadAccounts} />
                </div>
                {!acc.is_active && (
                  <button onClick={() => switchAccount(acc.id)} disabled={!!switchingId}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors disabled:opacity-40">
                    {switchingId === acc.id ? <Loader2 size={11} className="animate-spin" /> : null}
                    Usar esta
                  </button>
                )}
                {!acc.is_active && (
                  <button onClick={() => removeAccount(acc)} disabled={removingId === acc.id}
                    title="Remover desta empresa"
                    className="shrink-0 w-7 h-7 flex items-center justify-center text-zinc-700 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors disabled:opacity-40">
                    {removingId === acc.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                )}
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
  const [cfg, setCfg] = useState({ provider: "", uazapi_url: "", uazapi_key: "", uazapi_instance: "", official_token: "", official_phone_id: "", whatsapp_number: "", user_name: "", alerts_whatsapp_enabled: false, daily_analysis_enabled: false, daily_analysis_morning: 9, daily_analysis_afternoon: 15, qr: null as string | null, connected: false, _token_saved: false })
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [refreshingQr, setRefreshingQr] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  async function load() {
    const [d, me] = await Promise.all([
      api.get("/settings/whatsapp").catch(() => null),
      api.get("/auth/me").catch(() => null),
    ])
    if (d) setCfg(prev => ({ ...prev, ...d }))
    if (me?.is_admin) setIsAdmin(true)
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
      await api.post("/settings/whatsapp", { provider: cfg.provider, uazapi_url: cfg.uazapi_url, uazapi_key: cfg.uazapi_key, uazapi_instance: cfg.uazapi_instance, official_token: cfg.official_token, official_phone_id: cfg.official_phone_id, whatsapp_number: cfg.whatsapp_number, user_name: cfg.user_name, alerts_whatsapp_enabled: cfg.alerts_whatsapp_enabled, daily_analysis_enabled: cfg.daily_analysis_enabled, daily_analysis_morning: cfg.daily_analysis_morning, daily_analysis_afternoon: cfg.daily_analysis_afternoon })
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
      {/* Provider — admin only */}
      {isAdmin && <Card>
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
            <Field label="Token" badge={!cfg.uazapi_key && cfg._token_saved ? "salvo" : undefined}>
              <input type="password" placeholder={cfg._token_saved ? "••••••••••••• (deixe vazio para manter)" : "seu-token"} value={cfg.uazapi_key} onChange={e => setCfg(c => ({ ...c, uazapi_key: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Nome da instância"><input type="text" placeholder="gtpro-alertas" value={cfg.uazapi_instance} onChange={e => setCfg(c => ({ ...c, uazapi_instance: e.target.value }))} className={inputCls} /></Field>

            <Field label="URL do Webhook (cole na UazAPI)">
              <div className="flex items-center gap-2 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg px-3 py-2.5">
                <span className="flex-1 text-[12px] text-zinc-400 truncate select-all">
                  {typeof window !== "undefined" ? `${window.location.origin}/api/whatsapp/webhook` : "/api/whatsapp/webhook"}
                </span>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/whatsapp/webhook`)}
                  className="text-[11px] text-violet-400 hover:text-violet-300 shrink-0 transition-colors"
                >
                  Copiar
                </button>
              </div>
            </Field>

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
      </Card>}

      {/* Tenant number */}
      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">Meu número para alertas</h2>
        <p className="text-[12px] text-zinc-600 -mt-3">Número que receberá as notificações desta conta. Inclua o DDI.</p>
        <Field label="Seu nome (para personalizar as mensagens)">
          <input type="text" placeholder="Ex: João" value={cfg.user_name} onChange={e => setCfg(c => ({ ...c, user_name: e.target.value }))} className={inputCls} />
        </Field>
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

      {/* Daily analysis */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[13px] font-semibold text-zinc-200">Análise Diária Autônoma</h2>
            <p className="text-[12px] text-zinc-600 mt-0.5">O agente analisa suas campanhas e envia um relatório pelo WhatsApp 2× ao dia, com insights e recomendações de ação.</p>
          </div>
          <Toggle value={cfg.daily_analysis_enabled} onChange={v => { setCfg(c => ({ ...c, daily_analysis_enabled: v })); setSaved(false) }} />
        </div>

        {cfg.daily_analysis_enabled && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Horário da manhã">
                <Select
                  value={cfg.daily_analysis_morning}
                  onChange={v => setCfg(c => ({ ...c, daily_analysis_morning: +v }))}
                  options={Array.from({ length: 13 }, (_, i) => i + 6).map(h => ({ value: h, label: `${String(h).padStart(2, "0")}:00` }))}
                />
              </Field>
              <Field label="Horário da tarde">
                <Select
                  value={cfg.daily_analysis_afternoon}
                  onChange={v => setCfg(c => ({ ...c, daily_analysis_afternoon: +v }))}
                  options={Array.from({ length: 12 }, (_, i) => i + 12).map(h => ({ value: h, label: `${String(h).padStart(2, "0")}:00` }))}
                />
              </Field>
            </div>
            <p className="text-[11px] text-zinc-600">Horários em fuso de Brasília (BRT). O agente irá buscar os dados das últimas 24h e comparar com os 7 dias anteriores.</p>
          </div>
        )}

        <SaveBtn saving={saving} saved={saved} onClick={save} />
      </Card>
    </div>
  )
}

// ─── Tab: Skills ──────────────────────────────────────────────────────────────

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

// ─── Tab: API Keys ────────────────────────────────────────────────────────────

function ApiKeysTab() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([])
  const [newKeyName, setNewKeyName] = useState("")
  const [selectedAccIds, setSelectedAccIds] = useState<string[]>([])
  const [generatedKey, setGeneratedKey] = useState("")
  const [copiedKey, setCopiedKey] = useState(false)
  const [creatingKey, setCreatingKey] = useState(false)
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null)
  const [editAccIds, setEditAccIds] = useState<string[]>([])

  useEffect(() => {
    api.get("/settings/api-keys").then(d => setApiKeys(Array.isArray(d) ? d : []))
    api.get("/meta/accounts").then(d => setMetaAccounts(Array.isArray(d) ? d : []))
  }, [])

  function toggleAcc(ids: string[], accId: string): string[] {
    return ids.includes(accId) ? ids.filter(x => x !== accId) : [...ids, accId]
  }

  async function createApiKey() {
    if (!newKeyName.trim()) return
    setCreatingKey(true)
    const result = await api.post("/settings/api-keys", {
      name: newKeyName,
      scope: "read_write",
      ad_account_ids: selectedAccIds.length ? selectedAccIds : null,
    })
    setGeneratedKey(result.key)
    setApiKeys(p => [...p, result])
    setNewKeyName("")
    setSelectedAccIds([])
    setCreatingKey(false)
  }

  async function saveEditAccounts(keyId: string) {
    try {
      const updated = await api.patch(`/settings/api-keys/${keyId}`, {
        ad_account_ids: editAccIds.length ? editAccIds : null,
      })
      if (updated) {
        setApiKeys(p => p.map(k => k.id === keyId ? { ...k, ad_account_ids: updated.ad_account_ids ?? null } : k))
      }
    } catch (e) {
      console.error("saveEditAccounts error", e)
    } finally {
      setEditingKeyId(null)
    }
  }

  async function deleteKey(keyId: string) {
    try {
      await api.delete(`/settings/api-keys/${keyId}`)
    } catch {}
    setApiKeys(p => p.filter(k => k.id !== keyId))
  }

  function copyKey(key: string) { navigator.clipboard.writeText(key); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000) }

  function accountName(adAccountId: string) {
    return metaAccounts.find(a => a.ad_account_id === adAccountId)?.name ?? adAccountId
  }

  return (
    <div className="space-y-4 max-w-xl">
      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">API Keys</h2>
        <p className="text-[12px] text-zinc-500 -mt-3">
          Conecte outros sistemas ao GTPRO. Use a chave no header{" "}
          <code className="bg-white/[0.06] px-1 py-0.5 rounded text-[11px]">Authorization: Bearer &lt;chave&gt;</code>
        </p>

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

        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              placeholder="Nome (ex: Zaapply – Fernando)"
              value={newKeyName}
              onChange={e => setNewKeyName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && createApiKey()}
              className={cn(inputCls, "flex-1")}
            />
            <button
              onClick={createApiKey}
              disabled={creatingKey || !newKeyName.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.06] ring-1 ring-white/[0.08] hover:bg-white/[0.09] disabled:opacity-40 text-white text-[13px] font-medium rounded-lg transition-colors"
            >
              <Plus size={13} /> Gerar
            </button>
          </div>

          {metaAccounts.length > 0 && (
            <div className="rounded-lg ring-1 ring-white/[0.06] px-3 py-2.5 space-y-2">
              <p className="text-[11px] text-zinc-500 font-medium">Contas de anúncio desta chave <span className="text-zinc-600">(vazio = todas)</span></p>
              <div className="flex flex-wrap gap-2">
                {metaAccounts.map(acc => (
                  <button
                    key={acc.ad_account_id}
                    onClick={() => setSelectedAccIds(ids => toggleAcc(ids, acc.ad_account_id))}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ring-1 transition-colors",
                      selectedAccIds.includes(acc.ad_account_id)
                        ? "bg-blue-500/20 ring-blue-500/40 text-blue-300"
                        : "bg-white/[0.04] ring-white/[0.08] text-zinc-400 hover:bg-white/[0.07]"
                    )}
                  >
                    {selectedAccIds.includes(acc.ad_account_id) && <Check size={10} />}
                    {acc.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {apiKeys.length > 0 && (
          <div className="divide-y divide-white/[0.05] ring-1 ring-white/[0.06] rounded-lg overflow-hidden">
            {apiKeys.map(key => (
              <div key={key.id} className="px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] text-zinc-200">{key.name}</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">{key.created_at ? new Date(key.created_at).toLocaleDateString("pt-BR") : '—'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {metaAccounts.length > 0 && (
                      <button
                        onClick={() => {
                          if (editingKeyId === key.id) { setEditingKeyId(null); return }
                          setEditingKeyId(key.id)
                          setEditAccIds(key.ad_account_ids ?? [])
                        }}
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-colors"
                        title="Editar contas"
                      >
                        <Settings2 size={12} className="text-zinc-500" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteKey(key.id)}
                      className="w-7 h-7 flex items-center justify-center hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 size={13} className="text-zinc-600 hover:text-red-400" />
                    </button>
                  </div>
                </div>

                {key.ad_account_ids?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {key.ad_account_ids.map(accId => (
                      <span key={accId} className="px-2 py-0.5 rounded-full bg-blue-500/10 ring-1 ring-blue-500/20 text-[10px] text-blue-400">
                        {accountName(accId)}
                      </span>
                    ))}
                  </div>
                ) : metaAccounts.length > 0 ? (
                  <p className="text-[11px] text-zinc-600">Acessa todas as contas</p>
                ) : null}

                {editingKeyId === key.id && (
                  <div className="rounded-lg ring-1 ring-white/[0.08] bg-white/[0.03] px-3 py-2.5 space-y-2">
                    <p className="text-[11px] text-zinc-500 font-medium">Selecionar contas <span className="text-zinc-600">(vazio = todas)</span></p>
                    <div className="flex flex-wrap gap-2">
                      {metaAccounts.map(acc => (
                        <button
                          key={acc.ad_account_id}
                          onClick={() => setEditAccIds(ids => toggleAcc(ids, acc.ad_account_id))}
                          className={cn(
                            "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ring-1 transition-colors",
                            editAccIds.includes(acc.ad_account_id)
                              ? "bg-blue-500/20 ring-blue-500/40 text-blue-300"
                              : "bg-white/[0.04] ring-white/[0.08] text-zinc-400 hover:bg-white/[0.07]"
                          )}
                        >
                          {editAccIds.includes(acc.ad_account_id) && <Check size={10} />}
                          {acc.name}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => saveEditAccounts(key.id)} className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 ring-1 ring-blue-500/30 text-blue-300 text-[11px] font-medium rounded-lg transition-colors">
                        Salvar
                      </button>
                      <button onClick={() => setEditingKeyId(null)} className="px-3 py-1.5 text-zinc-500 hover:text-zinc-300 text-[11px] transition-colors">
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {apiKeys.length === 0 && !generatedKey && (
          <p className="text-[12px] text-zinc-600">Nenhuma chave criada ainda.</p>
        )}
      </Card>

      <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/[0.06] px-4 py-4 space-y-2">
        <p className="text-[12px] font-medium text-zinc-300">Como usar no Zaapply / Nexio</p>
        <ol className="text-[12px] text-zinc-500 space-y-1 list-decimal list-inside">
          <li>Gere uma API Key acima com nome "Zaapply – [seu nome]"</li>
          <li>Selecione as contas de anúncio que essa chave pode acessar</li>
          <li>Copie a chave (exibida uma única vez)</li>
          <li>No Zaapply: Configurações → Integrações → GTPRO · Meta Ads → Cole a chave</li>
        </ol>
      </div>
    </div>
  )
}

// ─── Tab: Plataforma ──────────────────────────────────────────────────────────

function PlataformaTab() {
  const [platform, setPlatform] = useState({ anthropic_api_key_set: false, openai_api_key_set: false })
  const [anthropicKey, setAnthropicKey] = useState("")
  const [openaiKey, setOpenaiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [showOpenaiKey, setShowOpenaiKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [savingOpenai, setSavingOpenai] = useState(false)
  const [savedOpenai, setSavedOpenai] = useState(false)
  const [error, setError] = useState("")
  const [errorOpenai, setErrorOpenai] = useState("")
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

  async function saveOpenaiKey() {
    if (!openaiKey.trim()) return
    setSavingOpenai(true); setErrorOpenai("")
    try {
      await api.post("/settings/platform", { openai_api_key: openaiKey })
      setPlatform(await api.get("/settings/platform"))
      setOpenaiKey(""); setSavedOpenai(true); setTimeout(() => setSavedOpenai(false), 3000)
    } catch (e: any) { setErrorOpenai(e.message) } finally { setSavingOpenai(false) }
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
        <h2 className="text-[13px] font-semibold text-zinc-200">OpenAI API Key</h2>
        <p className="text-[12px] text-zinc-600 -mt-3">Opcional — usada só na geração de relatórios (mais barata que Claude pra esse texto). Sem chave configurada, relatórios continuam usando Claude normalmente.</p>
        {errorOpenai && <div className="text-[12px] text-red-400 bg-red-500/10 ring-1 ring-red-500/20 rounded-lg px-3 py-2">{errorOpenai}</div>}
        <Field label="API Key" badge={platform.openai_api_key_set ? "configurada" : undefined}>
          <div className="relative">
            <input type={showOpenaiKey ? "text" : "password"} placeholder={platform.openai_api_key_set ? "Deixe vazio para manter" : "sk-..."} value={openaiKey} onChange={e => setOpenaiKey(e.target.value)} className={cn(inputCls, "pr-10")} />
            <button type="button" onClick={() => setShowOpenaiKey(v => !v)} className="absolute right-3 top-2.5 text-zinc-600 hover:text-zinc-400">{showOpenaiKey ? <EyeOff size={13} /> : <Eye size={13} />}</button>
          </div>
        </Field>
        <SaveBtn saving={savingOpenai} saved={savedOpenai} onClick={saveOpenaiKey} />
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

// ─── Tab: Google Ads ──────────────────────────────────────────────────────────

interface GoogleAccount { id: string; customer_id: string; customer_name: string; currency_code: string; is_active: boolean; manager_customer_id: string | null; created_at: string }
interface ClientLink {
  id: string; name: string; is_active: boolean
  meta_connection_id: string | null; google_connection_id: string | null
  meta_connection: { id: string; ad_account_id: string; name: string } | null
  google_connection: { id: string; customer_id: string; customer_name: string } | null
}

function GoogleAdsTab() {
  const searchParams = useSearchParams()
  const [isAdmin, setIsAdmin] = useState(false)
  const [platform, setPlatform] = useState({ google_client_id: "", google_client_secret_set: false, google_developer_token_set: false })
  const [form, setForm] = useState({ google_client_id: "", google_client_secret: "", google_developer_token: "" })
  const [showSecret, setShowSecret]   = useState(false)
  const [showDevToken, setShowDevToken] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [credErr, setCredErr] = useState("")
  const [googleStatus, setGoogleStatus] = useState<{ connected: boolean; active?: GoogleAccount; accounts?: GoogleAccount[] } | null>(null)
  const [connecting, setConnecting]   = useState(false)
  const [googleMsg, setGoogleMsg]     = useState<{ type: "ok"|"err"|"info"; text: string } | null>(null)
  const [accounts, setAccounts]       = useState<GoogleAccount[]>([])
  const [switchingId, setSwitchingId] = useState<string | null>(null)

  function loadStatus() {
    api.get("/google/status").then((d: any) => {
      setGoogleStatus(d)
      setAccounts(d.accounts ?? [])
    }).catch(() => setGoogleStatus({ connected: false }))
  }

  useEffect(() => {
    api.get("/auth/me").then((me: any) => { if (me?.is_admin) setIsAdmin(true) }).catch(() => {})
    api.get("/settings/platform").then((d: any) => {
      setPlatform({ google_client_id: d.google_client_id ?? "", google_client_secret_set: !!d.google_client_secret_set, google_developer_token_set: !!d.google_developer_token_set })
      if (d.google_client_id) setForm(f => ({ ...f, google_client_id: d.google_client_id }))
    }).catch(() => {})
    loadStatus()
  }, [])

  useEffect(() => {
    const g = searchParams.get("google"), msg = searchParams.get("msg")
    if (g === "connected")  { setGoogleMsg({ type: "ok",   text: "Google Ads conectado com sucesso!" }); loadStatus() }
    else if (g === "denied")  setGoogleMsg({ type: "info", text: "Conexão cancelada." })
    else if (g === "expired") setGoogleMsg({ type: "err",  text: "Link expirado. Tente novamente." })
    else if (g === "error")   setGoogleMsg({ type: "err",  text: msg ? decodeURIComponent(msg) : "Erro ao conectar." })
  }, [searchParams])

  async function saveCreds() {
    setSaving(true); setCredErr("")
    const payload: Record<string, string> = {}
    if (form.google_client_id)       payload.google_client_id = form.google_client_id
    if (form.google_client_secret)   payload.google_client_secret = form.google_client_secret
    if (form.google_developer_token) payload.google_developer_token = form.google_developer_token
    if (!Object.keys(payload).length) { setCredErr("Preencha pelo menos um campo."); setSaving(false); return }
    try {
      await api.post("/settings/platform", payload)
      const u = await api.get("/settings/platform")
      setPlatform({ google_client_id: u.google_client_id ?? "", google_client_secret_set: !!u.google_client_secret_set, google_developer_token_set: !!u.google_developer_token_set })
      if (u.google_client_id) setForm(f => ({ ...f, google_client_id: u.google_client_id }))
      setForm(f => ({ ...f, google_client_secret: "", google_developer_token: "" }))
      setSaved(true); setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { setCredErr(e.message) } finally { setSaving(false) }
  }

  async function connect() {
    setConnecting(true)
    try {
      const { url } = await api.get("/google/connect")
      window.open(url, "_blank")
    } catch (e: any) { setGoogleMsg({ type: "err", text: e.message }) } finally { setConnecting(false) }
  }

  async function switchAccount(id: string) {
    setSwitchingId(id)
    try {
      await api.post("/google/accounts", { id })
      setGoogleMsg({ type: "ok", text: "Conta ativada." })
      loadStatus()
    } catch (e: any) { setGoogleMsg({ type: "err", text: e.message }) } finally { setSwitchingId(null) }
  }

  return (
    <div className="space-y-4 max-w-xl">
      {/* Admin: credentials */}
      {isAdmin && (
        <Card>
          <h2 className="text-[13px] font-semibold text-zinc-200">Credenciais do Google Cloud</h2>
          <p className="text-[12px] text-zinc-600 -mt-3">Necessário para autenticação OAuth com o Google Ads.</p>
          {credErr && <div className="text-[12px] text-red-400 bg-red-500/10 ring-1 ring-red-500/20 rounded-lg px-3 py-2">{credErr}</div>}
          <div className="space-y-3">
            <Field label="Client ID">
              <input type="text" placeholder={platform.google_client_id || "xxxx.apps.googleusercontent.com"} value={form.google_client_id} onChange={e => setForm(f => ({ ...f, google_client_id: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Client Secret" badge={platform.google_client_secret_set ? "configurado" : undefined}>
              <div className="relative">
                <input type={showSecret ? "text" : "password"} placeholder={platform.google_client_secret_set ? "Deixe vazio para manter" : "GOCSPX-..."} value={form.google_client_secret} onChange={e => setForm(f => ({ ...f, google_client_secret: e.target.value }))} className={cn(inputCls, "pr-10")} />
                <button type="button" onClick={() => setShowSecret(v => !v)} className="absolute right-3 top-2.5 text-zinc-600 hover:text-zinc-400">{showSecret ? <EyeOff size={13} /> : <Eye size={13} />}</button>
              </div>
            </Field>
            <Field label="Developer Token" badge={platform.google_developer_token_set ? "configurado" : undefined}>
              <div className="relative">
                <input type={showDevToken ? "text" : "password"} placeholder={platform.google_developer_token_set ? "Deixe vazio para manter" : "Dev Token do Google Ads"} value={form.google_developer_token} onChange={e => setForm(f => ({ ...f, google_developer_token: e.target.value }))} className={cn(inputCls, "pr-10")} />
                <button type="button" onClick={() => setShowDevToken(v => !v)} className="absolute right-3 top-2.5 text-zinc-600 hover:text-zinc-400">{showDevToken ? <EyeOff size={13} /> : <Eye size={13} />}</button>
              </div>
            </Field>
          </div>
          <div className="bg-white/[0.02] rounded-lg px-3 py-2.5 space-y-1 text-[11px] text-zinc-600">
            <p className="font-medium text-zinc-500">Como obter as credenciais:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Google Cloud Console → APIs &amp; Services → Credentials → Create OAuth 2.0 Client ID</li>
              <li>Application type: Web application</li>
              <li>Authorized redirect URI: <span className="font-mono text-zinc-400">{typeof window !== "undefined" ? `${window.location.origin}/api/google/callback` : "/api/google/callback"}</span></li>
              <li>Developer Token: Google Ads Manager → Ferramentas → Centro de API</li>
            </ol>
          </div>
          <SaveBtn saving={saving} saved={saved} onClick={saveCreds} />
        </Card>
      )}

      {/* Connection */}
      <Card>
        <h2 className="text-[13px] font-semibold text-zinc-200">Conexão Google Ads</h2>
        {googleMsg && (
          <div className={cn("flex items-center gap-2 text-[12px] rounded-lg px-3 py-2 ring-1",
            googleMsg.type === "ok"   ? "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20" :
            googleMsg.type === "err"  ? "text-red-400 bg-red-500/10 ring-red-500/20" :
            "text-zinc-400 bg-white/[0.04] ring-white/[0.08]"
          )}>{googleMsg.text}</div>
        )}
        {googleStatus === null ? (
          <div className="flex items-center gap-2 text-zinc-600 text-[13px]"><Loader2 size={13} className="animate-spin" /> Verificando...</div>
        ) : googleStatus.connected ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-white/[0.03] ring-1 ring-white/[0.07] rounded-lg px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                  <TrendingUp size={13} className="text-blue-400" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-zinc-200">Google Ads conectado</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">
                    {googleStatus.active?.customer_name ?? googleStatus.active?.customer_id}
                    {googleStatus.active?.manager_customer_id ? " · MCC" : ""}
                  </p>
                </div>
              </div>
              <button onClick={connect} disabled={connecting} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-violet-400 hover:bg-violet-500/10 rounded-lg transition-colors disabled:opacity-40">
                {connecting ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />} Reconectar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {isAdmin && !platform.google_client_id && <p className="text-[12px] text-amber-400">Configure as credenciais acima antes de conectar.</p>}
            <button onClick={connect} disabled={connecting || (isAdmin && !platform.google_client_id)} className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-900 text-[13px] font-semibold rounded-lg hover:bg-zinc-100 disabled:opacity-40 transition-colors">
              {connecting ? <><Loader2 size={13} className="animate-spin" /> Redirecionando...</> : <><Link2 size={13} /> Conectar via OAuth</>}
            </button>
          </div>
        )}
      </Card>

      {/* Account list */}
      {accounts.length > 1 && (
        <Card>
          <h2 className="text-[13px] font-semibold text-zinc-200">Contas conectadas</h2>
          <p className="text-[12px] text-zinc-600 -mt-3">Selecione qual conta será usada para campanhas e insights.</p>
          <div className="space-y-1.5">
            {accounts.map(acc => (
              <div key={acc.id} className={cn("flex items-center gap-3 px-4 py-3 rounded-lg ring-1 transition-colors",
                acc.is_active ? "bg-blue-500/10 ring-blue-500/30" : "bg-white/[0.02] ring-white/[0.06]"
              )}>
                <div className={cn("w-2 h-2 rounded-full shrink-0", acc.is_active ? "bg-blue-400" : "bg-zinc-600")} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-zinc-200">{acc.customer_name || acc.customer_id}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{acc.customer_id} · {acc.currency_code}{acc.manager_customer_id ? " · MCC" : ""}</p>
                </div>
                {acc.is_active
                  ? <span className="text-[11px] text-blue-400 font-medium shrink-0">Ativa</span>
                  : <button onClick={() => switchAccount(acc.id)} disabled={!!switchingId}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors disabled:opacity-40">
                      {switchingId === acc.id ? <Loader2 size={11} className="animate-spin" /> : null} Usar esta
                    </button>
                }
              </div>
            ))}
          </div>
        </Card>
      )}

      <ClientLinkCard />
    </div>
  )
}

// ─── Vincular cliente (Meta + Google) ──────────────────────────────────────────
// Antes disso, o dropdown do header (Meta) e a lista de contas Google eram
// seletores independentes sem relação nenhuma — trocar um não trocava o outro.
// Isso vincula os dois por cliente, pra ativar juntos com um clique.

// Dropdown custom em vez de <select> nativo — o popup nativo do navegador é uma
// camada separada da página e às vezes ignora o tema escuro (bg-white/[0.0x] vira
// branco sólido no popup, quebrando o layout).
function Picker({ value, onChange, options, placeholder }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; disabled?: boolean }[]
  placeholder: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg text-[13px] text-left text-white hover:bg-white/[0.06] transition-colors">
        <span className={cn("truncate", !selected && "text-zinc-600")}>{selected ? selected.label : placeholder}</span>
        <ChevronDown size={14} className={cn("text-zinc-500 transition-transform shrink-0 ml-2", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-zinc-900 ring-1 ring-white/[0.12] rounded-lg shadow-xl py-1">
          {options.map(o => (
            <button key={o.value} type="button" disabled={o.disabled}
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={cn(
                "w-full text-left px-3.5 py-2 text-[13px] transition-colors truncate",
                o.disabled ? "text-zinc-700 cursor-not-allowed" :
                o.value === value ? "bg-violet-500/15 text-violet-300" : "text-zinc-300 hover:bg-white/[0.06]"
              )}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ClientLinkCard() {
  const [metaAccounts, setMetaAccounts]     = useState<MetaAccount[]>([])
  const [googleAccounts, setGoogleAccounts] = useState<GoogleAccount[]>([])
  const [clients, setClients]               = useState<ClientLink[]>([])
  const [name, setName]         = useState("")
  const [metaId, setMetaId]     = useState("")
  const [googleId, setGoogleId] = useState("")
  const [saving, setSaving]           = useState(false)
  const [activatingId, setActivatingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  function load() {
    api.get("/meta/accounts").then((d: any) => setMetaAccounts(Array.isArray(d) ? d : [])).catch(() => {})
    api.get("/google/accounts").then((d: any) => setGoogleAccounts(Array.isArray(d) ? d : [])).catch(() => {})
    api.clients.list().then((d: any) => setClients(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(load, [])

  async function createLink() {
    if (!name.trim()) { setMsg({ type: "err", text: "Dê um nome pro cliente." }); return }
    setSaving(true); setMsg(null)
    try {
      await api.clients.create({ name: name.trim(), meta_connection_id: metaId || null, google_connection_id: googleId || null })
      setName(""); setMetaId(""); setGoogleId("")
      setMsg({ type: "ok", text: "Cliente vinculado." })
      load()
    } catch (e: any) { setMsg({ type: "err", text: e.message }) } finally { setSaving(false) }
  }

  async function activate(id: string) {
    setActivatingId(id); setMsg(null)
    try {
      await api.clients.activate(id)
      setMsg({ type: "ok", text: "Cliente ativado — Meta e Google trocados juntos." })
      load()
    } catch (e: any) { setMsg({ type: "err", text: e.message }) } finally { setActivatingId(null) }
  }

  const linkedMetaIds   = new Set(clients.map(c => c.meta_connection_id).filter(Boolean))
  const linkedGoogleIds = new Set(clients.map(c => c.google_connection_id).filter(Boolean))

  return (
    <Card>
      <h2 className="text-[13px] font-semibold text-zinc-200">Vincular cliente (Meta + Google)</h2>
      <p className="text-[12px] text-zinc-600 -mt-3">Liga uma conta Meta e uma conta Google Ads da mesma empresa — ativar o cliente troca as duas juntas.</p>

      {msg && (
        <div className={cn("flex items-center gap-2 text-[12px] rounded-lg px-3 py-2 ring-1",
          msg.type === "ok" ? "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20" : "text-red-400 bg-red-500/10 ring-red-500/20"
        )}>{msg.text}</div>
      )}

      {clients.length > 0 && (
        <div className="space-y-1.5">
          {clients.map(c => (
            <div key={c.id} className={cn("flex items-center gap-3 px-4 py-3 rounded-lg ring-1 transition-colors",
              c.is_active ? "bg-violet-500/10 ring-violet-500/30" : "bg-white/[0.02] ring-white/[0.06]"
            )}>
              <div className={cn("w-2 h-2 rounded-full shrink-0", c.is_active ? "bg-violet-400" : "bg-zinc-600")} />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium text-zinc-200">{c.name}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5 flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                    {c.meta_connection?.name || c.meta_connection?.ad_account_id || "sem Meta"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    {c.google_connection?.customer_name || c.google_connection?.customer_id || "sem Google"}
                  </span>
                </p>
              </div>
              {c.is_active
                ? <span className="text-[11px] text-violet-400 font-medium shrink-0">Ativo</span>
                : <button onClick={() => activate(c.id)} disabled={!!activatingId}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-zinc-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition-colors disabled:opacity-40">
                    {activatingId === c.id ? <Loader2 size={11} className="animate-spin" /> : null} Ativar
                  </button>
              }
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 pt-1">
        <Field label="Nome do cliente">
          <input type="text" placeholder="Ex: Net Infinito Botucatu" value={name} onChange={e => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Conta Meta Ads">
          <Picker
            value={metaId}
            onChange={setMetaId}
            placeholder="— nenhuma —"
            options={metaAccounts.map(a => ({
              value: a.id,
              label: (a.name || a.ad_account_id) + (linkedMetaIds.has(a.id) ? " (já vinculada)" : ""),
              disabled: linkedMetaIds.has(a.id),
            }))}
          />
        </Field>
        <Field label="Conta Google Ads">
          <Picker
            value={googleId}
            onChange={setGoogleId}
            placeholder="— nenhuma —"
            options={googleAccounts.map(a => ({
              value: a.id,
              label: (a.customer_name || a.customer_id) + (linkedGoogleIds.has(a.id) ? " (já vinculada)" : ""),
              disabled: linkedGoogleIds.has(a.id),
            }))}
          />
        </Field>
        <div>
          <button onClick={createLink} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.09] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg ring-1 ring-white/[0.08] transition-colors">
            {saving ? <><Loader2 size={13} className="animate-spin" /> Vinculando...</> : "Vincular"}
          </button>
        </div>
      </div>
    </Card>
  )
}

// ─── Equipe ───────────────────────────────────────────────────────────────────

function EquipeTab() {
  const [members, setMembers] = useState<Member[]>([])
  const [pending, setPending] = useState<PendingInvite[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<string>("owner")
  const [loading, setLoading] = useState(true)
  const [loadErr, setLoadErr] = useState("")

  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("member")
  const [inviting, setInviting] = useState(false)
  const [inviteLink, setInviteLink] = useState("")
  const [inviteError, setInviteError] = useState("")
  const [copied, setCopied] = useState(false)

  const [removing, setRemoving] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setLoadErr("")
    try {
      const teamData = await api.team.members()
      setMembers(teamData.members ?? [])
      setPending(teamData.pending_invites ?? [])
      if (teamData.my_id) setMyId(teamData.my_id)
      if (teamData.my_role) setMyRole(teamData.my_role)
    } catch (err: any) {
      setLoadErr(err?.message ?? "Erro ao carregar equipe.")
      console.error("[EquipeTab] load error:", err)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteError("")
    setInviteLink("")
    try {
      const data = await api.team.invite(inviteEmail, inviteRole)
      setInviteLink(data.invite_url)
      setInviteEmail("")
      load()
    } catch (err: any) {
      setInviteError(err.message ?? "Erro ao criar convite.")
    }
    setInviting(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function removeMember(userId: string, name: string) {
    if (!confirm(`Remover ${name} da equipe?`)) return
    setRemoving(userId)
    try {
      await api.team.removeMember(userId)
      await load()
    } catch {}
    setRemoving(null)
  }

  async function changeRole(userId: string, role: string) {
    try {
      await api.team.updateRole(userId, role)
      await load()
    } catch {}
  }

  const canManage = ["owner", "admin", "super_admin"].includes(myRole)

  return (
    <div className="space-y-4">
      {loadErr && (
        <div className="bg-red-500/10 ring-1 ring-red-500/20 rounded-xl px-4 py-3 text-[12px] text-red-400">
          {loadErr}
        </div>
      )}
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[14px] font-semibold text-white">Membros da equipe</h2>
          <p className="text-[12px] text-zinc-500 mt-0.5">{members.length} {members.length === 1 ? "membro" : "membros"} ativos</p>
        </div>
        {canManage && (
          <button
            onClick={() => { setShowInvite(true); setInviteLink(""); setInviteError("") }}
            className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-medium rounded-lg transition-colors"
          >
            <Plus size={13} />
            Convidar
          </button>
        )}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 bg-[#111113] ring-1 ring-white/[0.08] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[14px] font-semibold text-white">Convidar membro</h3>
              <button onClick={() => setShowInvite(false)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <X size={16} />
              </button>
            </div>

            {inviteLink ? (
              <div className="space-y-4">
                <p className="text-[12px] text-zinc-400">Compartilhe este link com o convidado. Ele expira em 7 dias.</p>
                <div className="flex items-center gap-2 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg px-3 py-2.5">
                  <span className="flex-1 text-[11px] text-zinc-300 truncate">{inviteLink}</span>
                  <button onClick={copyLink} className="shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors">
                    {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                </div>
                <button
                  onClick={() => { setInviteLink(""); setShowInvite(false) }}
                  className="w-full py-2.5 bg-white/[0.06] hover:bg-white/[0.09] text-white text-[13px] font-medium rounded-lg ring-1 ring-white/[0.08] transition-colors"
                >
                  Fechar
                </button>
              </div>
            ) : (
              <form onSubmit={handleInvite} className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-1.5 block">E-mail</label>
                  <input
                    type="email"
                    placeholder="email@empresa.com"
                    value={inviteEmail}
                    onChange={e => { setInviteEmail(e.target.value); setInviteError("") }}
                    required
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-1.5 block">Permissão</label>
                  <Select value={inviteRole} onChange={setInviteRole} options={ROLE_OPTIONS} />
                </div>
                {inviteError && <p className="text-[12px] text-red-400">{inviteError}</p>}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowInvite(false)}
                    className="flex-1 py-2.5 bg-white/[0.04] hover:bg-white/[0.07] text-zinc-300 text-[13px] rounded-lg ring-1 ring-white/[0.08] transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[13px] font-medium rounded-lg transition-colors"
                  >
                    {inviting ? "Gerando..." : "Gerar link"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Members list */}
      <Card>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={18} className="animate-spin text-zinc-600" />
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {members.map(m => (
              <div key={m.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center shrink-0">
                  <span className="text-[12px] font-semibold text-violet-300">
                    {(m.name || m.email)[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-white font-medium truncate">{m.name || m.email}</p>
                  {m.name && <p className="text-[11px] text-zinc-500 truncate">{m.email}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {/* Role badge / selector */}
                  {m.role === "owner" || !canManage || m.id === myId ? (
                    <span className={cn(
                      "px-2 py-0.5 rounded-md text-[11px] font-medium",
                      m.role === "owner" ? "bg-amber-500/15 text-amber-400" :
                      m.role === "admin" ? "bg-violet-500/15 text-violet-400" :
                      "bg-zinc-700/50 text-zinc-400"
                    )}>
                      {ROLE_LABEL[m.role] ?? m.role}
                    </span>
                  ) : (
                    <select
                      value={m.role}
                      onChange={e => changeRole(m.id, e.target.value)}
                      className="text-[11px] bg-white/[0.04] ring-1 ring-white/[0.08] rounded-md px-2 py-0.5 text-zinc-300 focus:outline-none focus:ring-violet-500/50"
                    >
                      {ROLE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  )}
                  {/* Remove button */}
                  {canManage && m.id !== myId && m.role !== "owner" && (
                    <button
                      onClick={() => removeMember(m.id, m.name || m.email)}
                      disabled={removing === m.id}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {removing === m.id ? <Loader2 size={12} className="animate-spin" /> : <UserMinus size={12} />}
                      Remover
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pending invites */}
      {pending.length > 0 && (
        <div>
          <h3 className="text-[12px] font-medium text-zinc-500 uppercase tracking-widest mb-3">Convites pendentes</h3>
          <Card>
            <div className="divide-y divide-white/[0.04]">
              {pending.map(inv => (
                <div key={inv.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                    <Mail size={13} className="text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-zinc-300 truncate">{inv.email}</p>
                    <p className="text-[11px] text-zinc-600">
                      Expira em {new Date(inv.expires_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-md bg-zinc-700/50 text-zinc-400">
                    {ROLE_LABEL[inv.role] ?? inv.role} · pendente
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type TabId = "agente" | "meta" | "google" | "alertas" | "whatsapp" | "skills" | "equipe" | "api" | "plataforma"

function ConfiguracoesContent() {
  const [tab, setTab] = useState<TabId>("agente")
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    api.get("/auth/me").then(me => { if (me?.is_admin) setIsAdmin(true) }).catch(() => {})
  }, [])

  const visibleTabs = isAdmin ? TABS : TABS.filter(t => t.id !== "plataforma")

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[17px] font-semibold text-white">Configurações</h1>
        <p className="text-[12px] text-zinc-600 mt-0.5">Gerencie integrações, agente e preferências da conta</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-white/[0.06] overflow-x-auto">
        {visibleTabs.map(t => {
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
      {tab === "google"     && <GoogleAdsTab />}
      {tab === "alertas"    && <AlertasTab />}
      {tab === "whatsapp"   && <WhatsAppTab />}
      {tab === "skills"     && <SkillsTab />}
      {tab === "equipe"     && <EquipeTab />}
      {tab === "api"        && <ApiKeysTab />}
      {tab === "plataforma" && isAdmin && <PlataformaTab />}
    </div>
  )
}

export default function ConfiguracoesPage() {
  return <Suspense><ConfiguracoesContent /></Suspense>
}
