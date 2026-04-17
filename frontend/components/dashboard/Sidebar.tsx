"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Megaphone, Bot, FileText, Bell, Settings, LogOut } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { useRouter } from "next/navigation"

const navItems = [
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/agente", label: "Agente IA", icon: Bot },
  { href: "/relatorios", label: "Relatórios", icon: FileText },
  { href: "/alertas", label: "Alertas", icon: Bell },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push("/login")
  }

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-zinc-900 border-r border-zinc-800">
      <div className="px-6 py-5 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-violet-400" size={20} />
          <span className="font-bold text-white text-lg">GTPRO</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              pathname.startsWith(href)
                ? "bg-violet-600/20 text-violet-300"
                : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-zinc-800 space-y-1">
        <Link
          href="/configuracoes"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          <Settings size={16} />
          Configurações
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
        >
          <LogOut size={16} />
          Sair
        </button>
      </div>
    </aside>
  )
}
