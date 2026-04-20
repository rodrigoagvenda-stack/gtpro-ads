"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import { Check, X, Loader2, Shield } from "lucide-react"
import { useRouter } from "next/navigation"

interface Tenant {
  user_id: string
  tenant_id: string
  role: string
  nome: string
  email: string
  onboarding_completed: boolean
  created_at: string
}

export default function AdminPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(true)
  const [denied, setDenied]   = useState(false)
  const router = useRouter()

  useEffect(() => {
    api.get("/admin/tenants")
      .then(d => {
        if (d?.error) { setDenied(true); return }
        setTenants(d ?? [])
      })
      .catch(() => setDenied(true))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-zinc-600 text-[13px]">Carregando...</div>

  if (denied) return (
    <div className="p-8 flex flex-col items-center gap-3 text-center">
      <Shield size={32} className="text-zinc-600" />
      <p className="text-[14px] font-medium text-zinc-300">Acesso restrito</p>
      <p className="text-[12px] text-zinc-600">Esta área é exclusiva para administradores.</p>
      <button onClick={() => router.push("/campanhas")} className="mt-2 text-[12px] text-violet-400 hover:text-violet-300">
        Voltar ao dashboard
      </button>
    </div>
  )

  const fmt = (d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white flex items-center gap-2">
          <Shield size={18} className="text-violet-400" /> Administração
        </h1>
        <p className="text-[12px] text-zinc-500 mt-1">{tenants.length} conta(s) ativa(s) na plataforma</p>
      </div>

      <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl overflow-hidden">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-white/[0.05]">
              {["Nome", "E-mail", "Role", "Onboarding", "Criado em"].map(h => (
                <th key={h} className="text-left px-4 py-3 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {tenants.map(t => (
              <tr key={t.tenant_id} className="hover:bg-white/[0.02] transition-colors">
                <td className="px-4 py-3 text-zinc-200 font-medium">{t.nome}</td>
                <td className="px-4 py-3 text-zinc-400">{t.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                    t.role === "super_admin" ? "bg-violet-500/20 text-violet-300" : "bg-zinc-700 text-zinc-400"
                  }`}>{t.role}</span>
                </td>
                <td className="px-4 py-3">
                  {t.onboarding_completed
                    ? <span className="flex items-center gap-1 text-emerald-400"><Check size={13} /> Concluído</span>
                    : <span className="flex items-center gap-1 text-zinc-500"><X size={13} /> Pendente</span>}
                </td>
                <td className="px-4 py-3 text-zinc-500">{fmt(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
