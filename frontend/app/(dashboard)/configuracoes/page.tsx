"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { api } from "@/lib/api"
import {
  Check, Copy, Eye, EyeOff, Plus, Trash2, RefreshCw,
  LayoutGrid, Link2, Unlink, AlertCircle, Loader2,
} from "lucide-react"

interface ApiKey {
  id: string
  name: string
  scope: string
  active: boolean
  created_at: string
}

const OBJETIVOS = [
  { value: "LEADS", label: "Geração de Leads" },
  { value: "SALES", label: "Vendas / E-commerce" },
  { value: "TRAFFIC", label: "Tráfego" },
  { value: "AWARENESS", label: "Reconhecimento de marca" },
  { value: "APP_INSTALLS", label: "Instalações de app" },
]

function ConfiguracoesContent() {
  const searchParams = useSearchParams()

  // Platform credentials
  const [platform, setPlatform] = useState({ anthropic_api_key_set: false, meta_app_id: "", meta_app_secret_set: false })
  const [form, setForm] = useState({ anthropic_api_key: "", meta_app_id: "", meta_app_secret: "" })
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showMetaSecret, setShowMetaSecret] = useState(false)
  const [savingPlatform, setSavingPlatform] = useState(false)
  const [savedPlatform, setSavedPlatform] = useState(false)
  const [platformError, setPlatformError] = useState("")

  // Meta connection
  const [metaStatus, setMetaStatus] = useState<{ connected: boolean; ad_account_id?: string; connected_at?: string } | null>(null)
  const [connectingMeta, setConnectingMeta] = useState(false)
  const [metaMsg, setMetaMsg] = useState<{ type: "success" | "error" | "info"; text: string } | null>(null)

  // Tenant / Agent config
  const [tenantConfig, setTenantConfig] = useState({
    objetivo_principal: "LEADS",
    roas_minimo: 2,
    cpl_maximo: 50,
    budget_mensal: "",
    modo_supervisionado: true,
    limite_budget_sem_aprovacao: 100,
  })
  const [savingTenant, setSavingTenant] = useState(false)
  const [savedTenant, setSavedTenant] = useState(false)

  // API Keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState("")
  const [generatedKey, setGeneratedKey] = useState("")
  const [copiedKey, setCopiedKey] = useState(false)
  const [creatingKey, setCreatingKey] = useState(false)

  useEffect(() => {
    api.get("/settings/platform").then((data) => {
      setPlatform(data)
      if (data.meta_app_id) setForm((f) => ({ ...f, meta_app_id: data.meta_app_id }))
    })
    api.get("/settings/api-keys").then((data) => setApiKeys(Array.isArray(data) ? data : []))
    api.meta.status().then(setMetaStatus).catch(() => setMetaStatus({ connected: false }))
    api.tenant.get().then((data) => {
      setTenantConfig({
        objetivo_principal: data.objetivo_principal ?? "LEADS",
        roas_minimo: data.roas_minimo ?? 2,
        cpl_maximo: data.cpl_maximo ?? 50,
        budget_mensal: data.budget_mensal ?? "",
        modo_supervisionado: data.modo_supervisionado ?? true,
        limite_budget_sem_aprovacao: data.limite_budget_sem_aprovacao ?? 100,
      })
    }).catch(() => {})
  }, [])

  // Handle OAuth callback result from query params
  useEffect(() => {
    const meta = searchParams.get("meta")
    const account = searchParams.get("account")
    const msg = searchParams.get("msg")
    if (meta === "connected") {
      setMetaMsg({ type: "success", text: `Meta Ads conectado com sucesso${account ? ` — conta "${account}"` : ""}` })
      api.meta.status().then(setMetaStatus)
    } else if (meta === "denied") {
      setMetaMsg({ type: "info", text: "Conexão cancelada pelo usuário." })
    } else if (meta === "expired") {
      setMetaMsg({ type: "error", text: "Link expirado. Tente novamente." })
    } else if (meta === "error") {
      setMetaMsg({ type: "error", text: msg ? decodeURIComponent(msg) : "Erro ao conectar Meta." })
    }
  }, [searchParams])

  async function savePlatformSettings() {
    setSavingPlatform(true)
    setPlatformError("")
    const payload: Record<string, string> = {}
    if (form.anthropic_api_key) payload.anthropic_api_key = form.anthropic_api_key
    if (form.meta_app_id) payload.meta_app_id = form.meta_app_id
    if (form.meta_app_secret) payload.meta_app_secret = form.meta_app_secret
    if (!Object.keys(payload).length) {
      setPlatformError("Preencha pelo menos um campo antes de salvar.")
      setSavingPlatform(false)
      return
    }
    try {
      await api.post("/settings/platform", payload)
      const updated = await api.get("/settings/platform")
      setPlatform(updated)
      if (updated.meta_app_id) setForm((f) => ({ ...f, meta_app_id: updated.meta_app_id }))
      setForm((f) => ({ ...f, anthropic_api_key: "", meta_app_secret: "" }))
      setSavedPlatform(true)
      setTimeout(() => setSavedPlatform(false), 5000)
    } catch (e: any) {
      setPlatformError(e.message || "Erro ao salvar")
    } finally {
      setSavingPlatform(false)
    }
  }

  async function connectMeta() {
    setConnectingMeta(true)
    try {
      const { url } = await api.meta.connect()
      window.location.href = url
    } catch (e: any) {
      setMetaMsg({ type: "error", text: e.message })
      setConnectingMeta(false)
    }
  }

  async function disconnectMeta() {
    if (!confirm("Desconectar a conta Meta Ads? As campanhas não poderão mais ser gerenciadas.")) return
    await api.meta.disconnect()
    setMetaStatus({ connected: false })
    setMetaMsg({ type: "info", text: "Conta Meta desconectada." })
  }

  async function saveTenantConfig() {
    setSavingTenant(true)
    try {
      await api.tenant.save({
        ...tenantConfig,
        roas_minimo: Number(tenantConfig.roas_minimo),
        cpl_maximo: Number(tenantConfig.cpl_maximo),
        budget_mensal: tenantConfig.budget_mensal ? Number(tenantConfig.budget_mensal) : null,
        limite_budget_sem_aprovacao: Number(tenantConfig.limite_budget_sem_aprovacao),
      })
      setSavedTenant(true)
      setTimeout(() => setSavedTenant(false), 5000)
    } catch (e: any) {
      alert(e.message)
    } finally {
      setSavingTenant(false)
    }
  }

  async function createApiKey() {
    if (!newKeyName.trim()) return
    setCreatingKey(true)
    const result = await api.post(`/settings/api-keys?name=${encodeURIComponent(newKeyName)}&scope=read_write`, null)
    setGeneratedKey(result.key)
    setApiKeys((prev) => [...prev, result])
    setNewKeyName("")
    setCreatingKey(false)
  }

  async function revokeKey(id: string) {
    await api.post(`/settings/api-keys/${id}`, null)
    setApiKeys((prev) => prev.filter((k) => k.id !== id))
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key)
    setCopiedKey(true)
    setTimeout(() => setCopiedKey(false), 2000)
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-white">Configurações</h1>

      {/* Credenciais da plataforma */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Credenciais da Plataforma</h2>

        {savedPlatform && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
            <Check size={14} /> Credenciais salvas com sucesso
          </div>
        )}
        {platformError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
            {platformError}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Anthropic API Key
              {platform.anthropic_api_key_set && <span className="ml-2 text-emerald-400">● configurada</span>}
            </label>
            <div className="relative">
              <input
                type={showAnthropicKey ? "text" : "password"}
                placeholder={platform.anthropic_api_key_set ? "••••••••••••• (deixe vazio para manter)" : "sk-ant-..."}
                value={form.anthropic_api_key}
                onChange={(e) => setForm((f) => ({ ...f, anthropic_api_key: e.target.value }))}
                className="w-full px-4 py-2.5 pr-10 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
              <button type="button" onClick={() => setShowAnthropicKey((v) => !v)} className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300">
                {showAnthropicKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Meta App ID</label>
            <input
              type="text"
              placeholder={platform.meta_app_id || "1234567890"}
              value={form.meta_app_id}
              onChange={(e) => setForm((f) => ({ ...f, meta_app_id: e.target.value }))}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Meta App Secret
              {platform.meta_app_secret_set && <span className="ml-2 text-emerald-400">● configurado</span>}
            </label>
            <div className="relative">
              <input
                type={showMetaSecret ? "text" : "password"}
                placeholder={platform.meta_app_secret_set ? "••••••••••••• (deixe vazio para manter)" : "App Secret"}
                value={form.meta_app_secret}
                onChange={(e) => setForm((f) => ({ ...f, meta_app_secret: e.target.value }))}
                className="w-full px-4 py-2.5 pr-10 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
              <button type="button" onClick={() => setShowMetaSecret((v) => !v)} className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300">
                {showMetaSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        </div>

        <button
          onClick={savePlatformSettings}
          disabled={savingPlatform}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {savedPlatform ? <><Check size={14} /> Salvo</> : savingPlatform ? <><RefreshCw size={14} className="animate-spin" /> Salvando...</> : "Salvar credenciais"}
        </button>
      </section>

      {/* Conexão Meta Ads */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Conexão Meta Ads</h2>
          <p className="text-xs text-zinc-500 mt-1">Conecte sua conta de anúncios para o agente gerenciar suas campanhas.</p>
        </div>

        {metaMsg && (
          <div className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm border ${
            metaMsg.type === "success" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            : metaMsg.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-400"
            : "bg-blue-500/10 border-blue-500/30 text-blue-400"
          }`}>
            <AlertCircle size={14} className="mt-0.5 shrink-0" />
            {metaMsg.text}
          </div>
        )}

        {metaStatus === null ? (
          <div className="flex items-center gap-2 text-zinc-500 text-sm"><Loader2 size={14} className="animate-spin" /> Verificando...</div>
        ) : metaStatus.connected ? (
          <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
                <LayoutGrid size={16} className="text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-200">Meta Ads conectado</p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Conta: {metaStatus.ad_account_id}
                  {metaStatus.connected_at && ` · desde ${new Date(metaStatus.connected_at).toLocaleDateString("pt-BR")}`}
                </p>
              </div>
            </div>
            <button onClick={disconnectMeta} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:bg-zinc-700 rounded-md transition-colors">
              <Unlink size={12} /> Desconectar
            </button>
          </div>
        ) : (
          <button
            onClick={connectMeta}
            disabled={connectingMeta || !platform.meta_app_id}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {connectingMeta ? <><Loader2 size={14} className="animate-spin" /> Redirecionando...</> : <><Link2 size={14} /> Conectar conta Meta Ads</>}
          </button>
        )}

        {!platform.meta_app_id && (
          <p className="text-xs text-yellow-500">Configure o Meta App ID e App Secret acima antes de conectar.</p>
        )}
      </section>

      {/* Configurações do Agente */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Configurações do Agente</h2>
          <p className="text-xs text-zinc-500 mt-1">Define os limites e objetivos que o GTPRO usa para tomar decisões.</p>
        </div>

        {savedTenant && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
            <Check size={14} /> Configurações salvas
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="block text-xs text-zinc-400 mb-1.5">Objetivo principal</label>
            <select
              value={tenantConfig.objetivo_principal}
              onChange={(e) => setTenantConfig((c) => ({ ...c, objetivo_principal: e.target.value }))}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
            >
              {OBJETIVOS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">ROAS mínimo</label>
            <input
              type="number" step="0.1" min="0"
              value={tenantConfig.roas_minimo}
              onChange={(e) => setTenantConfig((c) => ({ ...c, roas_minimo: Number(e.target.value) }))}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
            <p className="text-xs text-zinc-600 mt-1">Campanhas abaixo disso serão alertadas</p>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">CPL máximo (R$)</label>
            <input
              type="number" step="1" min="0"
              value={tenantConfig.cpl_maximo}
              onChange={(e) => setTenantConfig((c) => ({ ...c, cpl_maximo: Number(e.target.value) }))}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
            <p className="text-xs text-zinc-600 mt-1">Custo por lead aceitável</p>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Budget mensal (R$) — opcional</label>
            <input
              type="number" step="100" min="0"
              placeholder="Ex: 5000"
              value={tenantConfig.budget_mensal}
              onChange={(e) => setTenantConfig((c) => ({ ...c, budget_mensal: e.target.value }))}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Limite sem aprovação (R$)</label>
            <input
              type="number" step="50" min="0"
              value={tenantConfig.limite_budget_sem_aprovacao}
              onChange={(e) => setTenantConfig((c) => ({ ...c, limite_budget_sem_aprovacao: Number(e.target.value) }))}
              className="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
            />
            <p className="text-xs text-zinc-600 mt-1">Acima disto exige aprovação humana</p>
          </div>
        </div>

        <div className="flex items-center justify-between bg-zinc-800 rounded-lg px-4 py-3">
          <div>
            <p className="text-sm font-medium text-zinc-200">Modo supervisionado</p>
            <p className="text-xs text-zinc-500 mt-0.5">O agente propõe ações, mas aguarda aprovação antes de executar</p>
          </div>
          <button
            onClick={() => setTenantConfig((c) => ({ ...c, modo_supervisionado: !c.modo_supervisionado }))}
            className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${tenantConfig.modo_supervisionado ? "bg-violet-600" : "bg-zinc-700"}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${tenantConfig.modo_supervisionado ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
        </div>

        <button
          onClick={saveTenantConfig}
          disabled={savingTenant}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {savedTenant ? <><Check size={14} /> Salvo</> : savingTenant ? <><RefreshCw size={14} className="animate-spin" /> Salvando...</> : "Salvar configurações"}
        </button>
      </section>

      {/* GTPRO API Keys */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">GTPRO API Keys</h2>
          <p className="text-xs text-zinc-500 mt-1">Use essa key para conectar o MAX ou outros agentes ao GTPRO.</p>
        </div>

        {generatedKey && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <p className="text-xs text-emerald-400 mb-2 font-medium">Copie agora — não será exibida novamente</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-emerald-300 bg-zinc-900 px-3 py-2 rounded-md truncate">{generatedKey}</code>
              <button onClick={() => copyKey(generatedKey)} className="shrink-0 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors">
                {copiedKey ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-zinc-400" />}
              </button>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <input
            placeholder="Nome da key (ex: MAX)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createApiKey()}
            className="flex-1 px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
          <button
            onClick={createApiKey}
            disabled={creatingKey || !newKeyName.trim()}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus size={14} /> Gerar
          </button>
        </div>

        {apiKeys.length > 0 && (
          <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 overflow-hidden">
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-zinc-200">{key.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{key.scope} · criada em {new Date(key.created_at).toLocaleDateString("pt-BR")}</p>
                </div>
                <button onClick={() => revokeKey(key.id)} className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors" title="Revogar">
                  <Trash2 size={14} className="text-zinc-500 hover:text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default function ConfiguracoesPage() {
  return (
    <Suspense>
      <ConfiguracoesContent />
    </Suspense>
  )
}
