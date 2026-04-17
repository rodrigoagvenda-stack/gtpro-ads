"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { BarChart2 } from "lucide-react"

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
      setError(error.message)
      setLoading(false)
      return
    }
    router.push("/campanhas")
  }

  async function handleGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/campanhas` },
    })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#08080a]">
      <div className="w-full max-w-[360px] px-4">

        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-9 h-9 rounded-[10px] bg-violet-600 flex items-center justify-center mb-4">
            <BarChart2 size={18} className="text-white" />
          </div>
          <h1 className="text-[18px] font-semibold text-white tracking-tight">GTPRO</h1>
          <p className="text-[13px] text-zinc-500 mt-1">Gestão de tráfego com inteligência artificial</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50 transition-all"
          />
          <input
            type="password"
            placeholder="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-lg text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50 transition-all"
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

        <div className="flex items-center gap-3 my-4">
          <div className="flex-1 h-px bg-white/[0.06]" />
          <span className="text-[11px] text-zinc-600">ou</span>
          <div className="flex-1 h-px bg-white/[0.06]" />
        </div>

        <button
          onClick={handleGoogle}
          className="w-full py-2.5 bg-white/[0.04] ring-1 ring-white/[0.08] hover:bg-white/[0.07] text-white text-[13px] font-medium rounded-lg transition-colors"
        >
          Continuar com Google
        </button>
      </div>
    </div>
  )
}
