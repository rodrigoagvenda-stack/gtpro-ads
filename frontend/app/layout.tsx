import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

export const dynamic = "force-dynamic"

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "GTPRO — Gestão de Tráfego com IA",
  description: "Plataforma SaaS de gestão de tráfego pago com inteligência artificial",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full">
      <body className={`${inter.className} h-full bg-zinc-950 text-zinc-100`}>{children}</body>
    </html>
  )
}
