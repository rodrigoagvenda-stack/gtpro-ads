"use client"

import { useEffect, useRef, useState } from "react"
import { api } from "@/lib/api"
import { ChevronDown, Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface MetaAccount { id: string; ad_account_id: string; name: string; is_active: boolean }

export default function AccountPicker({ onSwitch }: { onSwitch?: () => void }) {
  const [accounts, setAccounts] = useState<MetaAccount[]>([])
  const [open, setOpen] = useState(false)
  const [switching, setSwitching] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  function load() {
    api.meta.accounts().then((d: MetaAccount[]) => setAccounts(Array.isArray(d) ? d : [])).catch(() => {})
  }

  useEffect(() => {
    load()
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const active = accounts.find(a => a.is_active)
  if (accounts.length < 1) return null

  async function switchTo(acc: MetaAccount) {
    if (acc.is_active || switching) return
    setSwitching(acc.id)
    try {
      await api.meta.switchAccount(acc.id)
      load()
      onSwitch?.()
    } catch {} finally { setSwitching(null); setOpen(false) }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.07] ring-1 ring-white/[0.08] rounded-lg text-[12px] text-zinc-300 transition-colors"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
        <span className="max-w-[200px] truncate">{active?.name || active?.ad_account_id || "Selecionar conta"}</span>
        <ChevronDown size={11} className={cn("text-zinc-500 transition-transform shrink-0", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-[#141414] ring-1 ring-white/[0.1] rounded-xl shadow-2xl z-50 overflow-hidden">
          <p className="px-4 py-2.5 text-[10px] font-medium text-zinc-600 uppercase tracking-widest border-b border-white/[0.05]">
            Contas de anúncios
          </p>
          <div className="py-1.5 max-h-72 overflow-y-auto">
            {accounts.map(acc => (
              <button
                key={acc.id}
                onClick={() => switchTo(acc)}
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
