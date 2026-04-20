"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

export default function CadastroPage() {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const supabase = createClient()

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
    setLoading(true)
    setError("")

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
    })
    const data = await res.json()

    if (!res.ok || data.error) {
      setError(data.error ?? "Erro ao criar conta.")
      setLoading(false)
      return
    }

    // Sign in automatically after registration
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: form.email,
      password: form.password,
    })

    if (signInError) {
      setError("Conta criada! Faça login para continuar.")
      router.push("/login")
      return
    }

    router.push("/campanhas")
  }

  const inputCls = "w-full px-3.5 py-2.5 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50 transition-all"

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
      <div className="w-full max-w-[360px] px-4">

        <div className="flex flex-col items-center mb-8">
          <Image src="/logo.png" alt="GTPRO" width={140} height={48} className="object-contain mb-2" priority />
          <p className="text-[13px] text-zinc-500 mt-1">Crie sua conta para começar</p>
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
            type="email"
            placeholder="E-mail"
            value={form.email}
            onChange={e => set("email", e.target.value)}
            required
            className={inputCls}
          />
          <input
            type="password"
            placeholder="Senha (mín. 6 caracteres)"
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
            disabled={loading}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg transition-colors"
          >
            {loading ? "Criando conta..." : "Criar conta"}
          </button>
        </form>

        <p className="text-center text-[12px] text-zinc-600 mt-5">
          Já tem uma conta?{" "}
          <Link href="/login" className="text-violet-400 hover:text-violet-300 transition-colors">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
