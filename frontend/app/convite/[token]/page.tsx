"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import Image from "next/image"
import Link from "next/link"

const ROLE_LABEL: Record<string, string> = {
  admin: "Admin",
  member: "Membro",
  owner: "Owner",
}

const inputCls =
  "w-full px-3.5 py-2.5 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50 transition-all"

export default function ConvitePage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [info, setInfo] = useState<{ email: string; role: string; tenant_name: string } | null>(null)
  const [loadError, setLoadError] = useState("")
  const [form, setForm] = useState({ name: "", password: "", confirm: "" })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/team/invite/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setLoadError(d.error)
        else setInfo(d)
      })
      .catch(() => setLoadError("Erro ao carregar convite."))
  }, [token])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
    setError("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      setError("As senhas não coincidem.")
      return
    }
    setSubmitting(true)
    setError("")

    const res = await fetch("/api/team/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name: form.name, password: form.password }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setError(data.error ?? "Erro ao entrar na empresa.")
      setSubmitting(false)
      return
    }

    // Login automático
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: form.password,
    })

    if (signInError) {
      router.push("/login")
      return
    }

    // Garante que o JWT tem o tenant_id atualizado antes de redirecionar
    await supabase.auth.refreshSession()

    router.push("/campanhas")
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
      <div className="w-full max-w-[360px] px-4">
        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="GTPRO" width={140} height={48} className="object-contain mb-2" priority />
          <p className="text-[13px] text-zinc-500 mt-1">Você foi convidado para uma equipe</p>
        </div>

        {loadError ? (
          <div className="bg-red-500/10 ring-1 ring-red-500/20 rounded-xl p-5 text-center">
            <p className="text-[13px] text-red-400">{loadError}</p>
            <Link href="/login" className="mt-3 inline-block text-[12px] text-zinc-500 hover:text-zinc-300 transition-colors">
              Ir para o login
            </Link>
          </div>
        ) : !info ? (
          <p className="text-center text-[13px] text-zinc-600">Verificando convite...</p>
        ) : (
          <>
            <div className="bg-white/[0.03] ring-1 ring-white/[0.07] rounded-xl p-4 mb-5">
              <p className="text-[11px] text-zinc-500 uppercase tracking-widest mb-1">Empresa</p>
              <p className="text-[14px] font-semibold text-white">{info.tenant_name}</p>
              <p className="text-[12px] text-zinc-500 mt-1.5">
                Você entrará como <span className="text-violet-400 font-medium">{ROLE_LABEL[info.role] ?? info.role}</span>
                {" "}com o e-mail <span className="text-zinc-300">{info.email}</span>
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Seu nome"
                value={form.name}
                onChange={e => set("name", e.target.value)}
                required
                className={inputCls}
              />
              <input
                type="password"
                placeholder="Crie uma senha (mín. 6 caracteres)"
                value={form.password}
                onChange={e => set("password", e.target.value)}
                required
                className={inputCls}
              />
              <input
                type="password"
                placeholder="Confirmar senha"
                value={form.confirm}
                onChange={e => set("confirm", e.target.value)}
                required
                className={inputCls}
              />

              {error && <p className="text-[12px] text-red-400">{error}</p>}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg transition-colors"
              >
                {submitting ? "Entrando..." : "Aceitar convite"}
              </button>
            </form>

            <p className="text-center text-[12px] text-zinc-600 mt-5">
              Já tem uma conta?{" "}
              <Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors">
                Entrar
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
