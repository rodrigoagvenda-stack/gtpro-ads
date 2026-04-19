"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { formatCurrency } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Building2, Zap, Clock, AlertTriangle, CheckCircle, Code } from "lucide-react"

const ACCOUNT_STATUS: Record<number, { label: string; color: string }> = {
  1:   { label: "Ativa",               color: "text-emerald-400" },
  2:   { label: "Desativada",          color: "text-red-400" },
  3:   { label: "Inadimplente",        color: "text-red-400" },
  7:   { label: "Revisão de risco",    color: "text-amber-400" },
  9:   { label: "Período de graça",    color: "text-amber-400" },
  100: { label: "Encerramento",        color: "text-red-400" },
  101: { label: "Encerrada",           color: "text-zinc-500" },
}

const AUDIENCE_SUBTYPES: Record<string, string> = {
  CUSTOM:        "Lista personalizada",
  WEBSITE:       "Visitantes do site",
  APP:           "Usuários do app",
  LOOKALIKE:     "Semelhante",
  ENGAGEMENT:    "Engajamento",
  VIDEO:         "Visualizações de vídeo",
  PAGE:          "Fãs da página",
  OFFLINE:       "Offline",
  CLAIM:         "Reclamação",
}

export default function ContaPage() {
  const [account, setAccount] = useState<any>(null)
  const [pixels, setPixels] = useState<{ pixels: any[]; conversions: any[] }>({ pixels: [], conversions: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.allSettled([
      api.account.get(),
      api.pixels.list(),
    ]).then(([acc, pix]) => {
      if (acc.status === "fulfilled") setAccount(acc.value)
      else setError((acc as any).reason?.message ?? "Erro ao carregar conta")
      if (pix.status === "fulfilled") setPixels(pix.value)
      setLoading(false)
    })
  }, [])

  if (loading) return <div className="text-[13px] text-zinc-600 py-10">Carregando...</div>
  if (error) return (
    <div className="flex flex-col items-center py-20 gap-3">
      <AlertTriangle size={20} className="text-amber-400" />
      <p className="text-[13px] text-zinc-500">{error}</p>
    </div>
  )

  const status = ACCOUNT_STATUS[account?.account_status] ?? { label: `Status ${account?.account_status}`, color: "text-zinc-400" }
  const spent = account?.amount_spent ? Number(account.amount_spent) / 100 : 0
  const spendCap = account?.spend_cap ? Number(account.spend_cap) / 100 : 0
  const balance = account?.balance ? Number(account.balance) / 100 : null
  const spentPct = spendCap > 0 ? Math.min((spent / spendCap) * 100, 100) : 0

  return (
    <div className="space-y-7 max-w-4xl">
      <div>
        <h1 className="text-[17px] font-semibold text-white">Conta</h1>
        <p className="text-[12px] text-zinc-600 mt-0.5">Informações da conta Meta Ads</p>
      </div>

      {/* Account overview */}
      <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <Building2 size={16} className="text-violet-400" />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-zinc-100">{account?.name ?? "—"}</p>
              {account?.business_name && <p className="text-[11px] text-zinc-600 mt-0.5">{account.business_name}</p>}
            </div>
          </div>
          <span className={cn("text-[12px] font-medium", status.color)}>{status.label}</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Total gasto</p>
            <p className="text-[18px] font-semibold text-white mt-1">{formatCurrency(spent)}</p>
          </div>
          {spendCap > 0 && (
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Limite de gasto</p>
              <p className="text-[18px] font-semibold text-white mt-1">{formatCurrency(spendCap)}</p>
            </div>
          )}
          {balance !== null && (
            <div className="bg-white/[0.03] rounded-lg p-3">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Saldo</p>
              <p className="text-[18px] font-semibold text-white mt-1">{formatCurrency(balance)}</p>
            </div>
          )}
          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Moeda</p>
            <p className="text-[18px] font-semibold text-white mt-1">{account?.currency ?? "—"}</p>
          </div>
          <div className="bg-white/[0.03] rounded-lg p-3">
            <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Fuso horário</p>
            <p className="text-[13px] font-semibold text-white mt-1">{account?.timezone_name ?? "—"}</p>
          </div>
        </div>

        {spendCap > 0 && (
          <div>
            <div className="flex items-center justify-between text-[11px] text-zinc-600 mb-1.5">
              <span>Uso do limite</span>
              <span>{spentPct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", spentPct >= 90 ? "bg-red-500" : spentPct >= 70 ? "bg-amber-500" : "bg-violet-500")}
                style={{ width: `${spentPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Pixels */}
      {pixels.pixels.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Pixels</p>
          <div className="space-y-2">
            {pixels.pixels.map((px: any) => (
              <div key={px.id} className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl px-5 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                    <Code size={12} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="text-[13px] font-medium text-zinc-200">{px.name}</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">ID: {px.id}</p>
                  </div>
                </div>
                <div className="text-right">
                  {px.last_fired_time ? (
                    <>
                      <div className="flex items-center gap-1 justify-end">
                        <CheckCircle size={11} className="text-emerald-400" />
                        <span className="text-[11px] text-emerald-400">Ativo</span>
                      </div>
                      <p className="text-[10px] text-zinc-600 mt-0.5">
                        Último disparo: {new Date(px.last_fired_time).toLocaleDateString("pt-BR")}
                      </p>
                    </>
                  ) : (
                    <span className="text-[11px] text-zinc-600">Sem disparos</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Conversions */}
      {pixels.conversions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">Conversões personalizadas</p>
          <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
            <div className="divide-y divide-white/[0.04]">
              {pixels.conversions.map((cv: any) => (
                <div key={cv.id} className="flex items-center justify-between px-5 py-3 gap-3">
                  <div>
                    <p className="text-[13px] font-medium text-zinc-200">{cv.name}</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">{cv.event_source_type?.replace(/_/g, " ")}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {cv.last_fired_time ? (
                      <p className="text-[11px] text-zinc-500">{new Date(cv.last_fired_time).toLocaleDateString("pt-BR")}</p>
                    ) : (
                      <p className="text-[11px] text-zinc-700">Sem disparos</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
