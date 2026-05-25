"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem("gtpro_cookie_consent")
    if (!consent) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem("gtpro_cookie_consent", "accepted")
    setVisible(false)
  }

  function acceptEssential() {
    localStorage.setItem("gtpro_cookie_consent", "essential")
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 md:p-6">
      <div className="max-w-3xl mx-auto bg-zinc-900 border border-white/10 rounded-xl shadow-2xl p-5 flex flex-col gap-4 md:flex-row md:items-center md:gap-6">
        <div className="flex-1 text-sm text-zinc-400 leading-relaxed">
          <p>
            Usamos cookies essenciais para manter você autenticado e cookies analíticos
            (anonimizados) para melhorar a plataforma. Ao continuar, você concorda com nossa{" "}
            <Link href="/privacidade" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
              Política de Privacidade
            </Link>{" "}
            e{" "}
            <Link href="/termos" className="text-violet-400 hover:text-violet-300 underline underline-offset-2">
              Termos de Uso
            </Link>
            .
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={acceptEssential}
            className="px-3.5 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg transition-colors"
          >
            Só essenciais
          </button>
          <button
            onClick={accept}
            className="px-3.5 py-2 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors"
          >
            Aceitar todos
          </button>
        </div>
      </div>
    </div>
  )
}
