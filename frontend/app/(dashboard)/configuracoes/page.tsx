"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Check, Copy, Eye, EyeOff, Plus, Trash2, RefreshCw } from "lucide-react"

interface ApiKey {
  id: string
  name: string
  scope: string
  active: boolean
  created_at: string
}

export default function ConfiguracoesPage() {
  const [platform, setPlatform] = useState({
    anthropic_api_key_set: false,
    meta_app_id: "",
    meta_app_secret_set: false,
  })
  const [form, setForm] = useState({
    anthropic_api_key: "",
    meta_app_id: "",
    meta_app_secret: "",
  })
  const [showAnthropicKey, setShowAnthropicKey] = useState(false)
  const [showMetaSecret, setShowMetaSecret] = useState(false)
  const [savingPlatform, setSavingPlatform] = useState(false)
  const [savedPlatform, setSavedPlatform] = useState(false)

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [newKeyName, setNewKeyName] = useState("")
  const [generatedKey, setGeneratedKey] = useState("")
  const [copiedKey, setCopiedKey] = useState(false)
  const [creatingKey, setCreatingKey] = useState(false)

  useEffect(() => {
    api.get("/settings/platform").then(setPlatform)
    api.get("/settings/api-keys").then(setApiKeys)
  }, [])

  async function savePlatformSettings() {
    setSavingPlatform(true)
    const payload: Record<string, string> = {}
    if (form.anthropic_api_key) payload.anthropic_api_key = form.anthropic_api_key
    if (form.meta_app_id) payload.meta_app_id = form.meta_app_id
    if (form.meta_app_secret) payload.meta_app_secret = form.meta_app_secret

    await api.post("/settings/platform", payload)
    const updated = await api.get("/settings/platform")
    setPlatform(updated)
    setForm({ anthropic_api_key: "", meta_app_id: "", meta_app_secret: "" })
    setSavingPlatform(false)
    setSavedPlatform(true)
    setTimeout(() => setSavedPlatform(false), 2000)
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

      {/* Plataforma */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">Credenciais da Plataforma</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">
              Anthropic API Key
              {platform.anthropic_api_key_set && (
                <span className="ml-2 text-emerald-400">● configurada</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showAnthropicKey ? "text" : "password"}
                placeholder={platform.anthropic_api_key_set ? "••••••••••••• (deixe vazio para manter)" : "sk-ant-..."}
                value={form.anthropic_api_key}
                onChange={(e) => setForm((f) => ({ ...f, anthropic_api_key: e.target.value }))}
                className="w-full px-4 py-2.5 pr-10 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowAnthropicKey((v) => !v)}
                className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
              >
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
              {platform.meta_app_secret_set && (
                <span className="ml-2 text-emerald-400">● configurado</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showMetaSecret ? "text" : "password"}
                placeholder={platform.meta_app_secret_set ? "••••••••••••• (deixe vazio para manter)" : "App Secret"}
                value={form.meta_app_secret}
                onChange={(e) => setForm((f) => ({ ...f, meta_app_secret: e.target.value }))}
                className="w-full px-4 py-2.5 pr-10 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowMetaSecret((v) => !v)}
                className="absolute right-3 top-2.5 text-zinc-500 hover:text-zinc-300"
              >
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
          {savedPlatform ? (
            <><Check size={14} /> Salvo</>
          ) : savingPlatform ? (
            <><RefreshCw size={14} className="animate-spin" /> Salvando...</>
          ) : (
            "Salvar credenciais"
          )}
        </button>
      </section>

      {/* GTPRO API Keys — para conectar no MAX */}
      <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide">GTPRO API Keys</h2>
          <p className="text-xs text-zinc-500 mt-1">Use essa key para conectar o MAX ou outros agentes ao GTPRO.</p>
        </div>

        {generatedKey && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
            <p className="text-xs text-emerald-400 mb-2 font-medium">Copie agora — não será exibida novamente</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs text-emerald-300 bg-zinc-900 px-3 py-2 rounded-md truncate">
                {generatedKey}
              </code>
              <button
                onClick={() => copyKey(generatedKey)}
                className="shrink-0 p-2 bg-zinc-800 hover:bg-zinc-700 rounded-md transition-colors"
              >
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
            <Plus size={14} />
            Gerar
          </button>
        </div>

        {apiKeys.length > 0 && (
          <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800 overflow-hidden">
            {apiKeys.map((key) => (
              <div key={key.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm text-zinc-200">{key.name}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {key.scope} · criada em {new Date(key.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <button
                  onClick={() => revokeKey(key.id)}
                  className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors"
                  title="Revogar"
                >
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
