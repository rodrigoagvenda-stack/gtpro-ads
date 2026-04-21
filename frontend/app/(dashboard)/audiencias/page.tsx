"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Users, AlertTriangle, RefreshCw, Plus, X, ChevronDown } from "lucide-react"

const SUBTYPES: Record<string, { label: string; color: string }> = {
  CUSTOM:     { label: "Lista",       color: "text-violet-400" },
  WEBSITE:    { label: "Site",        color: "text-blue-400" },
  APP:        { label: "App",         color: "text-cyan-400" },
  LOOKALIKE:  { label: "Semelhante",  color: "text-emerald-400" },
  ENGAGEMENT: { label: "Engajamento", color: "text-amber-400" },
  VIDEO:      { label: "Vídeo",       color: "text-pink-400" },
  PAGE:       { label: "Página",      color: "text-blue-400" },
  OFFLINE:    { label: "Offline",     color: "text-zinc-400" },
}

const STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  200: { label: "Pronto",    dot: "bg-emerald-500" },
  201: { label: "Populando", dot: "bg-amber-500" },
  202: { label: "Pequeno",   dot: "bg-amber-500" },
  203: { label: "Inativo",   dot: "bg-zinc-600" },
}

function fmtSize(lower?: number, upper?: number) {
  if (!lower && !upper) return "—"
  const n = lower ?? upper ?? 0
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `~${(n / 1_000).toFixed(0)}k`
  return `~${n}`
}

// ─── Create modal ─────────────────────────────────────────────────────────────

type AudienceType = "lookalike" | "website" | "engagement"

const TYPE_OPTIONS: { value: AudienceType; label: string; desc: string }[] = [
  { value: "lookalike",   label: "Público Semelhante",    desc: "Baseado em um público existente" },
  { value: "website",     label: "Visitantes do Site",    desc: "Retargeting via Pixel" },
  { value: "engagement",  label: "Engajamento na Página", desc: "Pessoas que interagiram com sua página" },
]

const RETENTION_OPTIONS = [
  { value: 7,  label: "7 dias" },
  { value: 14, label: "14 dias" },
  { value: 30, label: "30 dias" },
  { value: 60, label: "60 dias" },
  { value: 90, label: "90 dias" },
  { value: 180,label: "180 dias" },
]

const PIXEL_EVENTS = ["PageView","ViewContent","Lead","AddToCart","Purchase"]
const ENGAGEMENT_TYPES = [
  { value: "PAGE_ENGAGED",    label: "Engajou com a página" },
  { value: "PAGE_VISITED",    label: "Visitou a página" },
  { value: "PAGE_LIKED",      label: "Curtiu a página" },
  { value: "PAGE_CTA_CLICKED",label: "Clicou no botão CTA" },
]

function CreateModal({ audiences, onClose, onCreate }: {
  audiences: any[]
  onClose: () => void
  onCreate: (a: any) => void
}) {
  const [type, setType]               = useState<AudienceType>("lookalike")
  const [name, setName]               = useState("")
  const [sourceId, setSourceId]       = useState("")
  const [country, setCountry]         = useState("BR")
  const [ratio, setRatio]             = useState(0.02)
  const [pixelId, setPixelId]         = useState("")
  const [retention, setRetention]     = useState(30)
  const [pixelEvent, setPixelEvent]   = useState("PageView")
  const [pageId, setPageId]           = useState("")
  const [engType, setEngType]         = useState("PAGE_ENGAGED")
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const lookalikes = audiences.filter(a => !["LOOKALIKE"].includes(a.subtype))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true); setError(null)
    try {
      let body: Record<string, any> = { type, name }
      if (type === "lookalike") {
        if (!sourceId) { setError("Selecione o público de origem"); setSaving(false); return }
        body = { ...body, source_audience_id: sourceId, country, ratio }
      } else if (type === "website") {
        if (!pixelId.trim()) { setError("Informe o Pixel ID"); setSaving(false); return }
        body = { ...body, pixel_id: pixelId, retention_days: retention, event: pixelEvent }
      } else {
        if (!pageId.trim()) { setError("Informe o Page ID"); setSaving(false); return }
        body = { ...body, page_id: pageId, retention_days: retention, engagement_type: engType }
      }
      const result = await api.audiences.create(body)
      onCreate(result)
      onClose()
    } catch (e: any) {
      setError(e.message)
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#111113] ring-1 ring-white/[0.10] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.07]">
          <h2 className="text-[15px] font-semibold text-white">Criar Público</h2>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {/* Type selector */}
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map(o => (
              <button key={o.value} type="button" onClick={() => setType(o.value)}
                className={cn("p-2.5 rounded-xl text-left ring-1 transition-all",
                  type === o.value
                    ? "bg-violet-600/20 ring-violet-500/40"
                    : "bg-white/[0.03] ring-white/[0.07] hover:bg-white/[0.06]"
                )}>
                <p className={cn("text-[12px] font-medium", type === o.value ? "text-violet-300" : "text-zinc-300")}>{o.label}</p>
                <p className="text-[10px] text-zinc-600 mt-0.5 leading-tight">{o.desc}</p>
              </button>
            ))}
          </div>

          {/* Name */}
          <div>
            <label className="block text-[11px] text-zinc-500 mb-1.5">Nome do público</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              placeholder="Ex: Lookalike Leads BR 2%"
              className="w-full bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg px-3.5 py-2 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50" />
          </div>

          {/* Lookalike fields */}
          {type === "lookalike" && (
            <>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1.5">Público de origem</label>
                <select value={sourceId} onChange={e => setSourceId(e.target.value)} required
                  className="w-full bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg px-3.5 py-2 text-[13px] text-white focus:outline-none focus:ring-violet-500/50 [color-scheme:dark]">
                  <option value="">Selecionar...</option>
                  {lookalikes.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name} ({fmtSize(a.approximate_count_lower_bound)})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1.5">País</label>
                  <input value={country} onChange={e => setCountry(e.target.value.toUpperCase())} maxLength={2}
                    placeholder="BR"
                    className="w-full bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg px-3.5 py-2 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50" />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1.5">Tamanho ({(ratio * 100).toFixed(0)}%)</label>
                  <input type="range" min={0.01} max={0.1} step={0.01} value={ratio} onChange={e => setRatio(Number(e.target.value))}
                    className="w-full accent-violet-500 mt-2" />
                </div>
              </div>
            </>
          )}

          {/* Website fields */}
          {type === "website" && (
            <>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1.5">Pixel ID</label>
                <input value={pixelId} onChange={e => setPixelId(e.target.value)} required
                  placeholder="123456789012345"
                  className="w-full bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg px-3.5 py-2 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1.5">Evento</label>
                  <select value={pixelEvent} onChange={e => setPixelEvent(e.target.value)}
                    className="w-full bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg px-3.5 py-2 text-[13px] text-white focus:outline-none focus:ring-violet-500/50 [color-scheme:dark]">
                    {PIXEL_EVENTS.map(ev => <option key={ev} value={ev}>{ev}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1.5">Retenção</label>
                  <select value={retention} onChange={e => setRetention(Number(e.target.value))}
                    className="w-full bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg px-3.5 py-2 text-[13px] text-white focus:outline-none focus:ring-violet-500/50 [color-scheme:dark]">
                    {RETENTION_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Engagement fields */}
          {type === "engagement" && (
            <>
              <div>
                <label className="block text-[11px] text-zinc-500 mb-1.5">Page ID</label>
                <input value={pageId} onChange={e => setPageId(e.target.value)} required
                  placeholder="123456789012345"
                  className="w-full bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg px-3.5 py-2 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1.5">Tipo de engajamento</label>
                  <select value={engType} onChange={e => setEngType(e.target.value)}
                    className="w-full bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg px-3.5 py-2 text-[13px] text-white focus:outline-none focus:ring-violet-500/50 [color-scheme:dark]">
                    {ENGAGEMENT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-500 mb-1.5">Retenção</label>
                  <select value={retention} onChange={e => setRetention(Number(e.target.value))}
                    className="w-full bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg px-3.5 py-2 text-[13px] text-white focus:outline-none focus:ring-violet-500/50 [color-scheme:dark]">
                    {RETENTION_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {error && <p className="text-[12px] text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 text-[13px] text-zinc-400 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-xl hover:bg-white/[0.07] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2 text-[13px] text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-colors disabled:opacity-50 font-medium">
              {saving ? "Criando..." : "Criar público"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AudienciasPage() {
  const [audiences, setAudiences] = useState<any[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [search, setSearch]       = useState("")
  const [showCreate, setShowCreate] = useState(false)

  function load() {
    setLoading(true)
    api.audiences.list()
      .then((d: any[]) => { setAudiences(Array.isArray(d) ? d : []); setLoading(false) })
      .catch((e: any)  => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const filtered = audiences.filter(a => !search || a.name?.toLowerCase().includes(search.toLowerCase()))
  const grouped  = filtered.reduce((acc: Record<string, any[]>, a) => {
    const key = a.subtype ?? "OTHER"
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  return (
    <div className="space-y-7">
      {showCreate && (
        <CreateModal
          audiences={audiences}
          onClose={() => setShowCreate(false)}
          onCreate={a => { setAudiences(prev => [a, ...prev]); load() }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-white">Audiências</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5">Públicos personalizados e semelhantes</p>
        </div>
        <div className="flex items-center gap-2">
          {!loading && !error && (
            <p className="text-[12px] text-zinc-600">{audiences.length} público{audiences.length !== 1 ? "s" : ""}</p>
          )}
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-medium rounded-lg transition-colors">
            <Plus size={12} /> Criar público
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-600 text-[13px]">
          <RefreshCw size={13} className="animate-spin" /> Carregando...
        </div>
      ) : error ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <AlertTriangle size={20} className="text-amber-400" />
          <p className="text-[13px] text-zinc-500">{error}</p>
        </div>
      ) : audiences.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-600/10 ring-1 ring-violet-500/20 flex items-center justify-center">
            <Users size={18} className="text-violet-400" />
          </div>
          <div className="text-center">
            <p className="text-[14px] font-medium text-white">Nenhum público encontrado</p>
            <p className="text-[12px] text-zinc-600 mt-1">Crie seu primeiro público para usar em campanhas.</p>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-medium rounded-lg transition-colors">
            <Plus size={12} /> Criar público
          </button>
        </div>
      ) : (
        <>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar audiência..."
            className="w-full max-w-xs bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg px-3.5 py-2 text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50"
          />

          <div className="space-y-6">
            {Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([subtype, items]) => {
              const meta = SUBTYPES[subtype] ?? { label: subtype, color: "text-zinc-400" }
              return (
                <div key={subtype}>
                  <p className={cn("text-[11px] font-medium uppercase tracking-widest mb-2", meta.color)}>
                    {meta.label} ({items.length})
                  </p>
                  <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
                    <div className="divide-y divide-white/[0.04]">
                      {(items as any[]).map((a: any) => {
                        const st = STATUS_LABELS[a.operation_status?.code] ?? STATUS_LABELS[a.operation_status] ?? null
                        return (
                          <div key={a.id} className="flex items-center justify-between px-5 py-3.5 gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] font-medium text-zinc-200 truncate">{a.name}</p>
                              <p className="text-[11px] text-zinc-600 mt-0.5">ID: {a.id}</p>
                            </div>
                            <div className="flex items-center gap-4 shrink-0">
                              <div className="text-right">
                                <p className="text-[13px] font-semibold text-zinc-300">
                                  {fmtSize(a.approximate_count_lower_bound, a.approximate_count_upper_bound)}
                                </p>
                                <p className="text-[10px] text-zinc-700">pessoas</p>
                              </div>
                              {st && (
                                <div className="flex items-center gap-1.5">
                                  <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                                  <span className="text-[11px] text-zinc-500">{st.label}</span>
                                </div>
                              )}
                              {a.time_created && (
                                <p className="text-[10px] text-zinc-700 hidden sm:block">
                                  {new Date(a.time_created).toLocaleDateString("pt-BR")}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
