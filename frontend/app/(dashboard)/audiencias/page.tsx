"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Users, AlertTriangle, RefreshCw } from "lucide-react"

const SUBTYPES: Record<string, { label: string; color: string }> = {
  CUSTOM:     { label: "Lista",            color: "text-violet-400" },
  WEBSITE:    { label: "Site",             color: "text-blue-400" },
  APP:        { label: "App",              color: "text-cyan-400" },
  LOOKALIKE:  { label: "Semelhante",       color: "text-emerald-400" },
  ENGAGEMENT: { label: "Engajamento",      color: "text-amber-400" },
  VIDEO:      { label: "Vídeo",            color: "text-pink-400" },
  PAGE:       { label: "Página",           color: "text-blue-400" },
  OFFLINE:    { label: "Offline",          color: "text-zinc-400" },
}

const STATUS_LABELS: Record<string, { label: string; dot: string }> = {
  200: { label: "Pronto",        dot: "bg-emerald-500" },
  201: { label: "Populando",     dot: "bg-amber-500" },
  202: { label: "Pequeno",       dot: "bg-amber-500" },
  203: { label: "Inativo",       dot: "bg-zinc-600" },
}

function fmtSize(lower?: number, upper?: number) {
  if (!lower && !upper) return "—"
  const n = lower ?? upper ?? 0
  if (n >= 1_000_000) return `~${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `~${(n / 1_000).toFixed(0)}k`
  return `~${n}`
}

export default function AudienciasPage() {
  const [audiences, setAudiences] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  useEffect(() => {
    api.audiences.list()
      .then((d: any[]) => { setAudiences(Array.isArray(d) ? d : []); setLoading(false) })
      .catch((e: any) => { setError(e.message); setLoading(false) })
  }, [])

  const filtered = audiences.filter(a =>
    !search || a.name?.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = SUBTYPES && filtered.reduce((acc: Record<string, any[]>, a) => {
    const key = a.subtype ?? "OTHER"
    if (!acc[key]) acc[key] = []
    acc[key].push(a)
    return acc
  }, {})

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-white">Audiências</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5">Públicos personalizados e semelhantes</p>
        </div>
        {!loading && !error && (
          <p className="text-[12px] text-zinc-600">{audiences.length} público{audiences.length !== 1 ? "s" : ""}</p>
        )}
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
        <div className="flex flex-col items-center py-20 gap-3">
          <Users size={20} className="text-zinc-600" />
          <p className="text-[13px] text-zinc-600">Nenhuma audiência encontrada.</p>
        </div>
      ) : (
        <>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
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
