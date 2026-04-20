"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Megaphone, Bot, FileText, Bell, Settings, LogOut, Zap, Link2, Home, Users, Building2, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"

const NAV_MAIN = [
  { href: "/home",       label: "Home",           icon: Home },
  { href: "/campanhas",  label: "Campanhas",       icon: Megaphone },
  { href: "/audiencias", label: "Audiências",      icon: Users },
  { href: "/conta",      label: "Conta",           icon: Building2 },
  { href: "/agente",     label: "Agente IA",       icon: Bot },
  { href: "/relatorios", label: "Relatórios",      icon: FileText },
  { href: "/alertas",    label: "Alertas",         icon: Bell },
  { href: "/rastreamento", label: "Rastreamento",  icon: Link2 },
]

const NAV_BOTTOM = [
  { href: "/onboarding", label: "Primeiros passos", icon: Zap },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
]

function NavLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: any; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-colors",
        active
          ? "bg-white/[0.08] text-white"
          : "text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04]"
      )}
    >
      <Icon
        size={14}
        className={cn(
          "shrink-0 transition-colors",
          active ? "text-violet-400" : "text-zinc-600 group-hover:text-zinc-400"
        )}
      />
      {label}
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(false)
  const [onboardingDone, setOnboardingDone] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const email = session.user.email
      const isAdminEmail = email === "admin@vendai.pro" || email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL
      if (isAdminEmail) setIsAdmin(true)
      api.get("/auth/me")
        .then(me => {
          if (me?.is_admin || isAdminEmail) setIsAdmin(true)
          setOnboardingDone(me?.onboarding_completed ?? true)
        })
        .catch(() => {})
    })
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside className="w-52 shrink-0 flex flex-col bg-[#0b0b0d] border-r border-white/[0.05]">
      {/* Logo */}
      <div className="h-[52px] flex items-center px-4 border-b border-white/[0.05]">
        <Image src="/logo.png" alt="GTPRO" width={90} height={28} className="object-contain" priority />
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 pt-3 pb-2 space-y-0.5">
        {NAV_MAIN.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} active={pathname === href || (href !== "/home" && pathname.startsWith(href))} />
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="px-2 pb-3 pt-2 border-t border-white/[0.05] space-y-0.5">
        {isAdmin && (
          <NavLink href="/admin" label="Admin" icon={Shield} active={pathname.startsWith("/admin")} />
        )}
        {NAV_BOTTOM.filter(({ href }) => href !== "/onboarding" || !onboardingDone).map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} active={pathname.startsWith(href)} />
        ))}
        <button
          onClick={handleLogout}
          className="w-full group flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors"
        >
          <LogOut size={14} className="shrink-0 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
          Sair
        </button>
      </div>
    </aside>
  )
}
