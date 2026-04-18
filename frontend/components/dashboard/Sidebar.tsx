"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Megaphone, Bot, FileText, Bell, Settings, LogOut, Zap, BarChart2, Link2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"

const NAV_MAIN = [
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/agente", label: "Agente IA", icon: Bot },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
  { href: "/alertas", label: "Alertas", icon: Bell },
  { href: "/rastreamento", label: "Rastreamento UTM", icon: Link2 },
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

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside className="w-52 shrink-0 flex flex-col bg-[#0b0b0d] border-r border-white/[0.05]">
      {/* Logo */}
      <div className="h-[52px] flex items-center px-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-2">
          <div className="w-[26px] h-[26px] rounded-[6px] bg-violet-600 flex items-center justify-center">
            <BarChart2 size={13} className="text-white" />
          </div>
          <span className="font-semibold text-[15px] text-white tracking-[-0.2px]">GTPRO</span>
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2 pt-3 pb-2 space-y-0.5">
        {NAV_MAIN.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} active={pathname.startsWith(href)} />
        ))}
      </nav>

      {/* Bottom nav */}
      <div className="px-2 pb-3 pt-2 border-t border-white/[0.05] space-y-0.5">
        {NAV_BOTTOM.map(({ href, label, icon }) => (
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
