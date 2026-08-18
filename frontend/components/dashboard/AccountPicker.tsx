"use client"

import { useEffect, useRef, useState } from "react"
import { api } from "@/lib/api"
import { ChevronDown, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface MetaAccount { id: string; ad_account_id: string; name: string; is_active: boolean }
interface ClientLink {
  id: string; name: string; is_active: boolean
  meta_connection: { id: string; ad_account_id: string; name: string } | null
  google_connection: { id: string; customer_id: string; customer_name: string } | null
}

// Antes, esse dropdown só trocava a conta Meta — trocar aqui não trocava a conta
// Google Ads ativa, elas ficavam dessincronizadas (causa do agente já ter
// reportado nome de um cliente junto com ID de outro). Agora usa os "clientes"
// vinculados (Meta + Google juntos) quando existir pelo menos um; se o tenant
// ainda não vinculou nenhum, cai de volta pro comportamento antigo (só Meta),
// pra não sumir o seletor de quem ainda não configurou nada.
export default function AccountPicker({ onSwitch }: { onSwitch?: () => void }) {
  const [clients, setClients]           = useState<ClientLink[]>([])
  const [metaAccounts, setMetaAccounts] = useState<MetaAccount[]>([])
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  function load() {
    api.clients.list().then((d: ClientLink[]) => setClients(Array.isArray(d) ? d : [])).catch(() => {})
    api.meta.accounts().then((d: MetaAccount[]) => setMetaAccounts(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => {
    load()
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const useClients = clients.length > 0
  const activeClient = useClients ? clients.find(c => c.is_active) : undefined
  const activeMeta    = !useClients ? metaAccounts.find(a => a.is_active) : undefined

  if (useClients ? clients.length < 1 : metaAccounts.length < 1) return null

  async function switchClient(c: ClientLink) {
    if (c.is_active || switching) return
    setSwitching(c.id)
    try {
      await api.clients.activate(c.id)
      load()
      onSwitch?.()
      window.dispatchEvent(new CustomEvent("account-switched", { detail: { clientId: c.id } }))
    } catch {} finally { setSwitching(null); setOpen(false) }
  }

  async function switchMeta(acc: MetaAccount) {
    if (acc.is_active || switching) return
    setSwitching(acc.id)
    try {
      await api.meta.switchAccount(acc.id)
      load()
      onSwitch?.()
      window.dispatchEvent(new CustomEvent("account-switched", { detail: { accountId: acc.id } }))
    } catch {} finally { setSwitching(null); setOpen(false) }
  }

  const label = useClients
    ? (activeClient?.name || "Selecionar cliente")
    : (activeMeta?.name || activeMeta?.ad_account_id || "Selecionar conta")

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-44 flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.07] ring-1 ring-white/[0.08] rounded-lg text-[12px] text-zinc-300 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
        <span className="flex-1 truncate text-left">{label}</span>
        <ChevronDown size={11} className={cn("text-zinc-500 transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#141414] ring-1 ring-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden">
          <p className="px-4 py-2.5 text-[10px] font-medium text-zinc-600 uppercase tracking-widest border-b border-white/[0.05]">
            {useClients ? "Clientes" : "Contas de anúncios"}
          </p>
          <div className="py-1.5 max-h-72 overflow-y-auto">
            {useClients ? clients.map(c => (
              <button
                key={c.id}
                onClick={() => switchClient(c)}
                disabled={c.is_active || !!switching}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left",
                  !c.is_active && "hover:bg-white/[0.04] cursor-pointer"
                )}
              >
                {switching === c.id
                  ? <Loader2 size={13} className="text-zinc-500 animate-spin shrink-0" />
                  : <div className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center shrink-0",
                      c.is_active ? "bg-violet-600 border-violet-600" : "border-zinc-600"
                    )}>
                      {c.is_active && <Check size={10} className="text-white" />}
                    </div>
                }
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[12px] font-medium truncate", c.is_active ? "text-white" : "text-zinc-400")}>
                    {c.name}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5 flex items-center gap-2 truncate">
                    {c.meta_connection && (
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                        {c.meta_connection.name || c.meta_connection.ad_account_id}
                      </span>
                    )}
                    {c.google_connection && (
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        {c.google_connection.customer_name || c.google_connection.customer_id}
                      </span>
                    )}
                    {!c.meta_connection && !c.google_connection && "sem contas vinculadas"}
                  </p>
                </div>
                {c.is_active && <span className="text-[10px] text-violet-400 shrink-0">Ativa</span>}
              </button>
            )) : metaAccounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => switchMeta(acc)}
                disabled={acc.is_active || !!switching}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left",
                  !acc.is_active && "hover:bg-white/[0.04] cursor-pointer"
                )}
              >
                {switching === acc.id
                  ? <Loader2 size={13} className="text-zinc-500 animate-spin shrink-0" />
                  : <div className={cn(
                      "w-5 h-5 rounded-full border flex items-center justify-center shrink-0",
                      acc.is_active ? "bg-violet-600 border-violet-600" : "border-zinc-600"
                    )}>
                      {acc.is_active && <Check size={10} className="text-white" />}
                    </div>
                }
                <div className="min-w-0 flex-1">
                  <p className={cn("text-[12px] font-medium truncate", acc.is_active ? "text-white" : "text-zinc-400")}>
                    {acc.name || "Conta principal"}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{acc.ad_account_id}</p>
                </div>
                {acc.is_active && <span className="text-[10px] text-violet-400 shrink-0">Ativa</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
