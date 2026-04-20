"use client"

import AccountPicker from "./AccountPicker"

export default function GlobalHeader() {
  return (
    <header className="h-[52px] shrink-0 flex items-center justify-end px-8 border-b border-white/[0.05] bg-[#08080a]">
      <AccountPicker />
    </header>
  )
}
