"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError("E-mail ou senha incorretos.")
      setLoading(false)
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
          <p className="text-[13px] text-zinc-500 mt-1">Gestão de tráfego com inteligência artificial</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className={inputCls}
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className={inputCls}
          />

          {error && <p className="text-[12px] text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-[13px] font-semibold rounded-lg transition-colors"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-[12px] text-zinc-600 mt-5">
          Não tem uma conta?{" "}
          <Link href="/cadastro" className="text-violet-400 hover:text-violet-300 transition-colors">
            Criar conta
          </Link>
        </p>
      </div>
    </div>
  )
}
