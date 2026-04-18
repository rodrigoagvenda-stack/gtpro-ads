"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import { Check, Copy, Eye, EyeOff, Plus, Trash2, RefreshCw, Link2, Unlink, Loader2, LayoutGrid } from "lucide-react"
import { cn } from "@/lib/utils"

interface ApiKey { id: string; name: string; scope: string; active: boolean; created_at: string }

const OBJETIVOS = [
  { value: "LEADS", label: "Geração de Leads" },
  { value: "SALES", label: "Vendas / E-commerce" },
  { value: "TRAFFIC", label: "Tráfego" },
  { value: "AWARENESS", label: "Reconhecimento" },
  { value: "APP_INSTALLS", label: "Instalações de app" },
]

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-6 space-y-5">
      <div>
        <h2 className="text-[13px] font-semibold text-zinc-200">{title}</h2>
        {description && <p className="text-[12px] text-zinc-600 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  )
}

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

const inputCls = "w-full px-3.5 py-2.5 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50 transition-all"

function ConfiguracoesContent() {
  const searchParams = useSearchParams()

  const [platform, setPlatform] = useState({ anthropic_api_key_set: false, meta_app_id: "", meta_app_secret_set: false })
  const [form, setForm] = useState({ anthropic_api_key: "", meta_app_id: "", meta_app_secret: "" })
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showMetaSecret, setShowMetaSecret] = useState(false)
  const [savingPlatform, setSavingPlatform] = useState(false)
  const [savedPlatform, setSavedPlatform] = useState(false)
  const [platformError, setPlatformError] = useState("")

  const [metaStatus, setMetaStatus] = useState<{ connected: boolean; ad_account_id?: string; connected_at?: string } | null>(null)
  const [connectingMeta, setConnectingMeta] = useState(false)
  const [metaMsg, setMetaMsg] = useState<{ type: "ok" | "err" | "info"; text: string } | null>(null)
  const [manualToken, setManualToken] = useState("")
  const [manualAccountId, setManualAccountId] = useState("")
  const [savingToken, setSavingToken] = useState(false)
  const [showManual, setShowManual] = useState(false)

  const [tenantConfig, setTenantConfig] = useState({ objetivo_principal: "LEADS", roas_minimo: 2, cpl_maximo: 50, budget_mensal: "", modo_supervisionado: true, limite_budget_sem_aprovacao: 100 })
  const [savingTenant, setSavingTenant] = useState(false)
  const [savedTenant, setSavedTenant] = useState(false)

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState("")
  const [generatedKey, setGeneratedKey] = useState("")
  const [copiedKey, setCopiedKey] = useState(false)
  const [creatingKey, setCreatingKey] = useState(false)

  useEffect(() => {
    api.get("/settings/platform").then((d) => {
      setPlatform(d)
      if (d.meta_app_id) setForm((f) => ({ ...f, meta_app_id: d.meta_app_id }))
    })
    api.get("/settings/api-keys").then((d) => setApiKeys(Array.isArray(d) ? d : []))
    api.meta.status().then(setMetaStatus).catch(() => setMetaStatus({ connected: false }))
    api.tenant.get().then((d) => setTenantConfig({ objetivo_principal: d.objetivo_principal ?? "LEADS", roas_minimo: d.roas_minimo ?? 2, cpl_maximo: d.cpl_maximo ?? 50, budget_mensal: d.budget_mensal ?? "", modo_supervisionado: d.modo_supervisionado ?? true, limite_budget_sem_aprovacao: d.limite_budget_sem_aprovacao ?? 100 })).catch(() => {})
  }, [])

  useEffect(() => {
    const meta = searchParams.get("meta")
    const account = searchParams.get("account")
    const msg = searchParams.get("msg")
    if (meta === "connected") { setMetaMsg({ type: "ok", text: `Meta Ads conectado${account ? ` — ${account}` : ""}` }); api.meta.status().then(setMetaStatus) }
    else if (meta === "denied") setMetaMsg({ type: "info", text: "Conexão cancelada." })
    else if (meta === "expired") setMetaMsg({ type: "err", text: "Link expirado. Tente novamente." })
    else if (meta === "error") setMetaMsg({ type: "err", text: msg ? decodeURIComponent(msg) : "Erro ao conectar." })
  }, [searchParams])

  async function savePlatform() {
    setSavingPlatform(true); setPlatformError("")
    const payload: Record<string, string> = {}
    if (form.anthropic_api_key) payload.anthropic_api_key = form.anthropic_api_key
    if (form.meta_app_id) payload.meta_app_id = form.meta_app_id
    if (form.meta_app_secret) payload.meta_app_secret = form.meta_app_secret
    if (!Object.keys(payload).length) { setPlatformError("Preencha pelo menos um campo."); setSavingPlatform(false); return }
    try {
      await api.post("/settings/platform", payload)
      const u = await api.get("/settings/platform")
      setPlatform(u)
      if (u.meta_app_id) setForm((f) => ({ ...f, meta_app_id: u.meta_app_id }))
      setForm((f) => ({ ...f, anthropic_api_key: "", meta_app_secret: "" }))
      setSavedPlatform(true); setTimeout(() => setSavedPlatform(false), 4000)
    } catch (e: any) { setPlatformError(e.message) } finally { setSavingPlatform(false) }
  }

  async function connectMeta() {
    setConnectingMeta(true)
    try { const { url } = await api.meta.connect(); window.open(url, "_blank") }
    catch (e: any) { setMetaMsg({ type: "err", text: e.message }); setConnectingMeta(false) }
  }

  async function disconnectMeta() {
    if (!confirm("Desconectar Meta Ads?")) return
    await api.meta.disconnect()
    setMetaStatus({ connected: false })
    setMetaMsg({ type: "info", text: "Conta desconectada." })
  }

  async function saveManualToken() {
    if (!manualToken.trim() || !manualAccountId.trim()) return
    setSavingToken(true)
    try {
      await api.meta.saveToken(manualToken.trim(), manualAccountId.trim())
      const status = await api.meta.status()
      setMetaStatus(status)
      setMetaMsg({ type: "ok", text: "Token salvo com sucesso." })
      setManualToken("")
      setManualAccountId("")
      setShowManual(false)
    } catch (e: any) {
      setMetaMsg({ type: "err", text: e.message })
    } finally {
      setSavingToken(false)
    }
  }

  async function saveTenant() {
    setSavingTenant(true)
    try {
      await api.tenant.save({ ...tenantConfig, roas_minimo: Number(tenantConfig.roas_minimo), cpl_maximo: Number(tenantConfig.cpl_maximo), budget_mensal: tenantConfig.budget_mensal ? Number(tenantConfig.budget_mensal) : null, limite_budget_sem_aprovacao: Number(tenantConfig.limite_budget_sem_aprovacao) })
      setSavedTenant(true); setTimeout(() => setSavedTenant(false), 4000)
    } catch (e: any) { alert(e.message) } finally { setSavingTenant(false) }
  }

  async function createApiKey() {
    if (!newKeyName.trim()) return
    setCreatingKey(true)
    const result = await api.post(`/settings/api-keys?name=${encodeURIComponent(newKeyName)}&scope=read_write`, null)
    setGeneratedKey(result.key); setApiKeys((p) => [...p, result]); setNewKeyName(""); setCreatingKey(false)
  }

  function copyKey(key: string) { navigator.clipboard.writeText(key); setCopiedKey(true); setTimeout(() => setCopiedKey(false), 2000) }

  const SaveBtn = ({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) => (
    <button onClick={onClick} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.09] disabled:opacity-50 text-white text-[13px] font-medium rounded-lg ring-1 ring-white/[0.08] transition-colors">
      {saved ? <><Check size={13} className="text-emerald-400" /> Salvo</> : saving ? <><RefreshCw size={13} className="animate-spin" /> Salvando...</> : "Salvar"}
    </button>
  )

  return (
    <div className="space-y-7 max-w-xl">
      <div>
        <h1 className="text-[17px] font-semibold text-white">Configurações</h1>
        <p className="text-[12px] text-zinc-600 mt-0.5">Credenciais, conexões e parâmetros do agente</p>
      </div>

      {/* Platform credentials */}
      <Section title="Credenciais da plataforma">
        {savedPlatform && <div className="flex items-center gap-2 text-[12px] text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-lg px-3 py-2"><Check size={12} /> Salvo com sucesso</div>}
        {platformError && <div className="text-[12px] text-red-400 bg-red-500/10 ring-1 ring-red-500/20 rounded-lg px-3 py-2">{platformError}</div>}

        <div className="space-y-3">
          <Field label="Anthropic API Key" badge={platform.anthropic_api_key_set ? "configurada" : undefined}>
            <div className="relative">
              <input type={showAnthropicKey ? "text" : "password"} placeholder={platform.anthropic_api_key_set ? "Deixe vazio para manter" : "sk-ant-..."} value={form.anthropic_api_key} onChange={(e) => setForm((f) => ({ ...f, anthropic_api_key: e.target.value }))} className={cn(inputCls, "pr-10")} />
              <button type="button" onClick={() => setShowAnthropicKey(v => !v)} className="absolute right-3 top-2.5 text-zinc-600 hover:text-zinc-400">{showAnthropicKey ? <EyeOff size={13} /> : <Eye size={13} />}</button>
            </div>
          </Field>
          <Field label="Meta App ID">
            <input type="text" placeholder={platform.meta_app_id || "1234567890"} value={form.meta_app_id} onChange={(e) => setForm((f) => ({ ...f, meta_app_id: e.target.value }))} className={inputCls} />
          </Field>
          <Field label="Meta App Secret" badge={platform.meta_app_secret_set ? "configurado" : undefined}>
            <div className="relative">
              <input type={showMetaSecret ? "text" : "password"} placeholder={platform.meta_app_secret_set ? "Deixe vazio para manter" : "App Secret"} value={form.meta_app_secret} onChange={(e) => setForm((f) => ({ ...f, meta_app_secret: e.target.value }))} className={cn(inputCls, "pr-10")} />
              <button type="button" onClick={() => setShowMetaSecret(v => !v)} className="absolute right-3 top-2.5 text-zinc-600 hover:text-zinc-400">{showMetaSecret ? <EyeOff size={13} /> : <Eye size={13} />}</button>
            </div>
          </Field>
        </div>
        <SaveBtn saving={savingPlatform} saved={savedPlatform} onClick={savePlatform} />
      </Section>

      {/* Meta connection */}
      <Section title="Conexão Meta Ads" description="Conecte sua conta de anúncios para o agente gerenciar campanhas.">
        {metaMsg && (
          <div className={cn("flex items-center gap-2 text-[12px] rounded-lg px-3 py-2 ring-1", metaMsg.type === "ok" ? "text-emerald-400 bg-emerald-500/10 ring-emerald-500/20" : metaMsg.type === "err" ? "text-red-400 bg-red-500/10 ring-red-500/20" : "text-zinc-400 bg-white/[0.04] ring-white/[0.08]")}>
            {metaMsg.text}
          </div>
        )}

        {metaStatus === null ? (
          <div className="flex items-center gap-2 text-zinc-600 text-[13px]"><Loader2 size={13} className="animate-spin" /> Verificando...</div>
        ) : metaStatus.connected ? (
          <div className="flex items-center justify-between bg-white/[0.03] ring-1 ring-white/[0.07] rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                <LayoutGrid size={13} className="text-blue-400" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-zinc-200">Meta Ads conectado</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">Conta {metaStatus.ad_account_id}{metaStatus.connected_at ? ` · desde ${new Date(metaStatus.connected_at).toLocaleDateString("pt-BR")}` : ""}</p>
              </div>
            </div>
            <button onClick={disconnectMeta} className="flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"><Unlink size={11} /> Desconectar</button>
          </div>
        ) : (
          <div className="space-y-3">
            {!platform.meta_app_id && <p className="text-[12px] text-amber-400">Configure o Meta App ID acima antes de conectar via OAuth.</p>}
            <button onClick={connectMeta} disabled={connectingMeta || !platform.meta_app_id} className="flex items-center gap-2 px-4 py-2.5 bg-white text-zinc-900 text-[13px] font-semibold rounded-lg hover:bg-zinc-100 disabled:opacity-40 transition-colors">
              {connectingMeta ? <><Loader2 size={13} className="animate-spin" /> Redirecionando...</> : <><Link2 size={13} /> Conectar via OAuth</>}
            </button>

            <div className="border-t border-white/[0.05] pt-3">
              <button onClick={() => setShowManual(v => !v)} className="text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
                {showManual ? "▲ Ocultar" : "▼ Tenho um System User Token permanente"}
              </button>
              {showManual && (
                <div className="mt-3 space-y-2">
                  <Field label="Access Token">
                    <input
                      type="password"
                      placeholder="EAAxxxxx..."
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Ad Account ID">
                    <input
                      type="text"
                      placeholder="act_123456789 ou 123456789"
                      value={manualAccountId}
                      onChange={(e) => setManualAccountId(e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                  <button
                    onClick={saveManualToken}
                    disabled={savingToken || !manualToken.trim() || !manualAccountId.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-medium rounded-lg transition-colors"
                  >
                    {savingToken ? <><Loader2 size={13} className="animate-spin" /> Salvando...</> : "Salvar token"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </Section>

      {/* Agent config */}
      <Section title="Configurações do agente" description="Parâmetros que o GTPRO usa para avaliar performance e tomar decisões.">
        {savedTenant && <div className="flex items-center gap-2 text-[12px] text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20 rounded-lg px-3 py-2"><Check size={12} /> Salvo</div>}

        <div className="space-y-3">
          <Field label="Objetivo principal">
            <select value={tenantConfig.objetivo_principal} onChange={(e) => setTenantConfig(c => ({ ...c, objetivo_principal: e.target.value }))} className={inputCls}>
              {OBJETIVOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ROAS mínimo">
              <input type="number" step="0.1" min="0" value={tenantConfig.roas_minimo} onChange={(e) => setTenantConfig(c => ({ ...c, roas_minimo: Number(e.target.value) }))} className={inputCls} />
            </Field>
            <Field label="CPL máximo (R$)">
              <input type="number" step="1" min="0" value={tenantConfig.cpl_maximo} onChange={(e) => setTenantConfig(c => ({ ...c, cpl_maximo: Number(e.target.value) }))} className={inputCls} />
            </Field>
            <Field label="Budget mensal (R$)">
              <input type="number" step="100" min="0" placeholder="Opcional" value={tenantConfig.budget_mensal} onChange={(e) => setTenantConfig(c => ({ ...c, budget_mensal: e.target.value }))} className={inputCls} />
            </Field>
            <Field label="Limite sem aprovação (R$)">
              <input type="number" step="50" min="0" value={tenantConfig.limite_budget_sem_aprovacao} onChange={(e) => setTenantConfig(c => ({ ...c, limite_budget_sem_aprovacao: Number(e.target.value) }))} className={inputCls} />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-between py-3 border-t border-white/[0.05]">
          <div>
            <p className="text-[13px] font-medium text-zinc-200">Modo supervisionado</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Agente propõe ações — você aprova antes de executar</p>
          </div>
          <button type="button" onClick={() => setTenantConfig(c => ({ ...c, modo_supervisionado: !c.modo_supervisionado }))} className={cn("shrink-0 w-11 h-6 rounded-full transition-colors relative", tenantConfig.modo_supervisionado ? "bg-violet-600" : "bg-zinc-700")}>
            <span className={cn("pointer-events-none absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", tenantConfig.modo_supervisionado ? "translate-x-5" : "translate-x-0")} />
          </button>
        </div>

        <SaveBtn saving={savingTenant} saved={savedTenant} onClick={saveTenant} />
      </Section>

      {/* API Keys */}
      <Section title="API Keys" description="Use para conectar o MAX ou outros agentes ao GTPRO.">
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
          <input placeholder="Nome da key (ex: MAX)" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createApiKey()} className={cn(inputCls, "flex-1")} />
          <button onClick={createApiKey} disabled={creatingKey || !newKeyName.trim()} className="flex items-center gap-1.5 px-4 py-2.5 bg-white/[0.06] ring-1 ring-white/[0.08] hover:bg-white/[0.09] disabled:opacity-40 text-white text-[13px] font-medium rounded-lg transition-colors">
            <Plus size={13} /> Gerar
          </button>
        </div>

        {apiKeys.length > 0 && (
          <div className="divide-y divide-white/[0.05] ring-1 ring-white/[0.06] rounded-lg overflow-hidden">
            {apiKeys.map((key) => (
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
      </Section>
    </div>
  )
}

export default function ConfiguracoesPage() {
  return <Suspense><ConfiguracoesContent /></Suspense>
}
