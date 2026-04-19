"use client"

import { useEffect, useState } from "react"
import Image from "next/image"

export default function Preloader() {
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFading(true), 600)
    const hideTimer = setTimeout(() => setVisible(false), 950)
    return () => { clearTimeout(fadeTimer); clearTimeout(hideTimer) }
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#08080a] transition-opacity duration-300"
      style={{ opacity: fading ? 0 : 1 }}
    >
      <div className="flex flex-col items-center gap-6">
        <Image src="/logo.png" alt="GTPRO" width={160} height={54} className="object-contain" priority />
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
