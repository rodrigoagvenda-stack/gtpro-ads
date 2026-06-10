"use client"

import { useState, useRef } from "react"
import {
  X, ChevronLeft, MapPin, Plus, Minus, Check, Upload, Hash,
  Info, Sparkles, Target, Users, Megaphone, MessageSquare,
  TrendingUp, Eye, Image as ImageIcon, Film, Loader2, AlertCircle,
} from "lucide-react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

export type WizardStep =
  | "objective" | "structure" | "abo_cbo" | "naming" | "geo"
  | "audience" | "placement" | "pixel" | "copy" | "cta"
  | "conversation" | "creative" | "schedule" | "budget" | "review"

export interface CampaignDraft {
  objective?: string
  objectiveLabel?: string
  campaigns?: number
  adsets?: number
  ads?: number
  budgetType?: "ABO" | "CBO"
  name?: string
  geo?: { key: string; name: string; region?: string; radius: number }[]
  includeAudiences?: string[]
  excludeAudiences?: string[]
  interests?: { id: string; name: string; audience_size?: number | null }[]
  advantagePlus?: boolean
  placement?: "advantage_plus" | "manual"
  customPlacements?: string[]
  pixelId?: string
  pixelEvent?: string
  copies?: { primary: string; headline: string; description: string }[]
  selectedCopyIndex?: number
  cta?: string
  conversationMessage?: string
  creativeType?: "upload" | "existing"
  creativeHash?: string
  creativeVideoId?: string
  creativeName?: string
  dynamicCreative?: boolean
  scheduleStart?: string
  scheduleEnd?: string
  alwaysOn?: boolean
  dailyBudget?: number
  lifetimeBudget?: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const OBJECTIVES = [
  { id: "OUTCOME_LEADS",      label: "Leads",       desc: "Formulários e geração de contatos",         icon: Users,         color: "text-blue-400 bg-blue-500/10 ring-blue-500/25" },
  { id: "OUTCOME_SALES",      label: "Vendas",       desc: "Compras, conversões e catálogo",            icon: TrendingUp,    color: "text-emerald-400 bg-emerald-500/10 ring-emerald-500/25" },
  { id: "OUTCOME_TRAFFIC",    label: "Tráfego",      desc: "Visitas ao site, app ou WhatsApp",          icon: Target,        color: "text-violet-400 bg-violet-500/10 ring-violet-500/25" },
  { id: "MESSAGES",           label: "WhatsApp",     desc: "Conversas no WhatsApp ou Messenger",        icon: MessageSquare, color: "text-teal-400 bg-teal-500/10 ring-teal-500/25" },
  { id: "OUTCOME_ENGAGEMENT", label: "Engajamento",  desc: "Curtidas, comentários, compartilhamentos",  icon: Megaphone,     color: "text-orange-400 bg-orange-500/10 ring-orange-500/25" },
  { id: "OUTCOME_AWARENESS",  label: "Alcance",      desc: "Reconhecimento de marca e alcance máximo",  icon: Eye,           color: "text-pink-400 bg-pink-500/10 ring-pink-500/25" },
]

const RADII = [10, 15, 25, 40, 50]

const CTA_BY_OBJECTIVE: Record<string, { id: string; label: string }[]> = {
  OUTCOME_LEADS:      [{ id: "LEARN_MORE", label: "Saiba mais" }, { id: "SIGN_UP", label: "Cadastre-se" }, { id: "GET_QUOTE", label: "Solicite orçamento" }, { id: "CONTACT_US", label: "Fale conosco" }],
  OUTCOME_SALES:      [{ id: "SHOP_NOW", label: "Compre agora" }, { id: "BUY_NOW", label: "Comprar" }, { id: "ORDER_NOW", label: "Fazer pedido" }, { id: "LEARN_MORE", label: "Saiba mais" }],
  OUTCOME_TRAFFIC:    [{ id: "LEARN_MORE", label: "Saiba mais" }, { id: "SHOP_NOW", label: "Ver produtos" }, { id: "SIGN_UP", label: "Cadastre-se" }, { id: "WATCH_MORE", label: "Assistir mais" }],
  MESSAGES:           [{ id: "SEND_MESSAGE", label: "Enviar mensagem" }, { id: "WHATSAPP_MESSAGE", label: "Enviar WhatsApp" }, { id: "MESSAGE_PAGE", label: "Mensagem" }],
  OUTCOME_ENGAGEMENT: [{ id: "LIKE_PAGE", label: "Curtir página" }, { id: "LEARN_MORE", label: "Saiba mais" }, { id: "WATCH_MORE", label: "Assistir mais" }],
  OUTCOME_AWARENESS:  [{ id: "LEARN_MORE", label: "Saiba mais" }, { id: "WATCH_MORE", label: "Assistir mais" }, { id: "GET_QUOTE", label: "Solicitar orçamento" }],
}

const PLACEMENTS = [
  { id: "facebook_feed",        label: "Facebook Feed" },
  { id: "instagram_feed",       label: "Instagram Feed" },
  { id: "instagram_reels",      label: "Instagram Reels" },
  { id: "facebook_reels",       label: "Facebook Reels" },
  { id: "stories",              label: "Stories (FB + IG)" },
  { id: "facebook_marketplace", label: "Marketplace" },
  { id: "messenger",            label: "Messenger" },
]

const PIXEL_EVENTS = [
  { id: "Lead",                   label: "Lead" },
  { id: "Purchase",               label: "Compra (Purchase)" },
  { id: "ViewContent",            label: "Visualização de conteúdo" },
  { id: "AddToCart",              label: "Adicionou ao carrinho" },
  { id: "InitiateCheckout",       label: "Iniciou checkout" },
  { id: "CompleteRegistration",   label: "Cadastro completo" },
]

// ─── Step helpers ─────────────────────────────────────────────────────────────

function getStepOrder(draft: CampaignDraft): WizardStep[] {
  const steps: WizardStep[] = ["objective", "structure", "abo_cbo", "naming", "geo", "audience", "placement"]
  const obj = draft.objective ?? ""
  if (obj === "OUTCOME_LEADS" || obj === "OUTCOME_SALES") steps.push("pixel")
  steps.push("copy", "cta")
  if (obj === "MESSAGES") steps.push("conversation")
  steps.push("creative", "schedule", "budget", "review")
  return steps
}

const STEP_LABELS: Record<WizardStep, string> = {
  objective: "Objetivo", structure: "Estrutura", abo_cbo: "Budget",
  naming: "Nome", geo: "Localização", audience: "Público",
  placement: "Placement", pixel: "Pixel", copy: "Copy",
  cta: "CTA", conversation: "Conversa", creative: "Criativo",
  schedule: "Programação", budget: "Orçamento", review: "Revisão",
}

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputCls = "w-full px-4 py-3 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-xl text-[13px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50 transition-all"
const toggleBtn = (on: boolean) => cn("shrink-0 w-10 h-6 rounded-full transition-colors relative", on ? "bg-violet-600" : "bg-zinc-700")
const toggleKnob = (on: boolean) => cn("absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform", on ? "left-5" : "left-1")

// ─── Step components ──────────────────────────────────────────────────────────

interface StepProps {
  draft: CampaignDraft
  setDraft: (d: CampaignDraft) => void
  onNext: () => void
  onBack: () => void
}

function StepObjective({ draft, setDraft, onNext }: StepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">Qual é o objetivo da campanha?</h3>
        <p className="text-[13px] text-zinc-500 mt-1">O resultado que você quer alcançar com este anúncio.</p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {OBJECTIVES.map(obj => {
          const Icon = obj.icon
          const selected = draft.objective === obj.id
          return (
            <button key={obj.id}
              onClick={() => { setDraft({ ...draft, objective: obj.id, objectiveLabel: obj.label }); onNext() }}
              className={cn(
                "flex items-start gap-3 p-4 rounded-xl ring-1 transition-all text-left",
                selected ? `${obj.color}` : "bg-white/[0.03] ring-white/[0.07] hover:bg-white/[0.06] hover:ring-white/[0.12]"
              )}>
              <div className={cn("shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5", selected ? obj.color : "bg-white/[0.05]")}>
                <Icon size={15} className={selected ? "" : "text-zinc-500"} />
              </div>
              <div>
                <p className={cn("text-[13px] font-semibold", selected ? "" : "text-zinc-200")}>{obj.label}</p>
                <p className="text-[11px] text-zinc-600 leading-snug mt-0.5">{obj.desc}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Counter({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white/[0.03] ring-1 ring-white/[0.07] rounded-xl">
      <span className="text-[13px] text-zinc-300 font-medium">{label}</span>
      <div className="flex items-center gap-3">
        <button onClick={() => onChange(Math.max(min, value - 1))} className="w-7 h-7 rounded-lg bg-white/[0.05] ring-1 ring-white/[0.08] flex items-center justify-center hover:bg-white/[0.1] transition-colors">
          <Minus size={12} className="text-zinc-400" />
        </button>
        <span className="text-[16px] font-bold text-white w-6 text-center tabular-nums">{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))} className="w-7 h-7 rounded-lg bg-white/[0.05] ring-1 ring-white/[0.08] flex items-center justify-center hover:bg-white/[0.1] transition-colors">
          <Plus size={12} className="text-zinc-400" />
        </button>
      </div>
    </div>
  )
}

function StepStructure({ draft, setDraft, onNext }: StepProps) {
  const campaigns = draft.campaigns ?? 1
  const adsets    = draft.adsets    ?? 1
  const ads       = draft.ads       ?? 1
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">Estrutura da campanha</h3>
        <p className="text-[13px] text-zinc-500 mt-1">Quantas campanhas, conjuntos e anúncios criar.</p>
      </div>
      <div className="space-y-2">
        <Counter label="Campanhas" value={campaigns} min={1} max={5} onChange={v => setDraft({ ...draft, campaigns: v })} />
        <Counter label="Conjuntos por campanha" value={adsets} min={1} max={10} onChange={v => setDraft({ ...draft, adsets: v })} />
        <Counter label="Anúncios por conjunto" value={ads} min={1} max={6} onChange={v => setDraft({ ...draft, ads: v })} />
      </div>
      <div className="px-4 py-3.5 bg-white/[0.02] ring-1 ring-white/[0.05] rounded-xl font-mono text-[12px] space-y-1">
        <p className="text-zinc-300">📁 Campanha <span className="text-violet-400">×{campaigns}</span></p>
        <p className="text-zinc-500 pl-4">└─ 📂 Conjunto <span className="text-violet-400">×{adsets}</span></p>
        <p className="text-zinc-600 pl-9">└─ 🖼 Anúncio <span className="text-violet-400">×{ads}</span></p>
        <p className="text-zinc-700 pl-9 text-[11px] mt-1">Total: {campaigns * adsets * ads} anúncios</p>
      </div>
      <button onClick={onNext} className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-semibold rounded-xl transition-colors">
        Próximo
      </button>
    </div>
  )
}

function StepAboCbo({ draft, setDraft, onNext }: StepProps) {
  const adsets      = draft.adsets ?? 1
  const recommended = adsets >= 3 ? "CBO" : "ABO"
  const selected    = draft.budgetType ?? recommended
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">Distribuição de orçamento</h3>
        <p className="text-[13px] text-zinc-500 mt-1">ABO dá controle por conjunto. CBO deixa o Meta otimizar.</p>
      </div>
      <div className={cn("flex items-start gap-3 px-4 py-3 rounded-xl ring-1",
        recommended === "ABO" ? "bg-blue-500/8 ring-blue-500/20 text-blue-300" : "bg-violet-500/8 ring-violet-500/20 text-violet-300"
      )}>
        <Info size={13} className="shrink-0 mt-0.5" />
        <p className="text-[12px] leading-snug">
          {adsets < 3
            ? `Com ${adsets} conjunto, recomendo ABO para controle total. CBO exige mínimo 3 conjuntos.`
            : recommended === "ABO"
              ? "Fase de teste: ABO permite controlar o gasto por conjunto e identificar o vencedor."
              : "Com 3+ conjuntos, CBO deixa o Meta distribuir o budget pelo melhor desempenho."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {(["ABO", "CBO"] as const).map(type => {
          const disabled  = type === "CBO" && adsets < 3
          const isSelected = selected === type
          return (
            <button key={type} disabled={disabled} onClick={() => setDraft({ ...draft, budgetType: type })}
              className={cn(
                "p-4 rounded-xl ring-1 transition-all text-left relative",
                disabled   ? "opacity-30 cursor-not-allowed bg-white/[0.02] ring-white/[0.05]" :
                isSelected ? "bg-violet-500/10 ring-violet-500/30 text-violet-300" :
                             "bg-white/[0.03] ring-white/[0.07] hover:bg-white/[0.06] text-zinc-400"
              )}>
              {isSelected && !disabled && <Check size={12} className="absolute top-3 right-3 text-violet-400" />}
              {recommended === type && !disabled && (
                <span className="absolute top-2 right-2 text-[9px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full">Recomendado</span>
              )}
              <p className="text-[15px] font-bold text-white mb-1">{type}</p>
              <p className="text-[11px] leading-snug">
                {type === "ABO" ? "Budget por conjunto. Controle total na fase de teste." : "Meta distribui pelos conjuntos com melhor desempenho."}
              </p>
              {disabled && <p className="text-[10px] text-red-400/70 mt-1">Mín. 3 conjuntos</p>}
            </button>
          )
        })}
      </div>
      <button onClick={() => { setDraft({ ...draft, budgetType: selected }); onNext() }} className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-semibold rounded-xl transition-colors">
        Próximo
      </button>
    </div>
  )
}

function StepNaming({ draft, setDraft, onNext }: StepProps) {
  const today    = new Date()
  const mo       = today.toLocaleString("pt-BR", { month: "short" }).toUpperCase().replace(".", "")
  const suggested = `${draft.objectiveLabel?.toUpperCase() ?? "CAMP"}-${mo}${today.getFullYear()}-FRIO`
  const name      = draft.name ?? suggested
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">Nome base da campanha</h3>
        <p className="text-[13px] text-zinc-500 mt-1">Usado como prefixo nos conjuntos e anúncios criados.</p>
      </div>
      <div className="space-y-2">
        <input type="text" value={name} onChange={e => setDraft({ ...draft, name: e.target.value })}
          placeholder={suggested}
          className={cn(inputCls, "font-mono")} />
        {name !== suggested && (
          <button onClick={() => setDraft({ ...draft, name: suggested })}
            className="text-[11px] text-zinc-600 hover:text-violet-400 transition-colors">
            Usar sugestão: {suggested}
          </button>
        )}
      </div>
      <p className="text-[11px] text-zinc-700">Padrão: OBJETIVO-MÊSANO-PÚBLICO</p>
      <button onClick={() => { setDraft({ ...draft, name: name.trim() || suggested }); onNext() }} disabled={!name.trim()}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-semibold rounded-xl transition-colors">
        Próximo
      </button>
    </div>
  )
}

function StepGeo({ draft, setDraft, onNext }: StepProps) {
  const [query,    setQuery]    = useState("")
  const [results,  setResults]  = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const geo = draft.geo ?? []
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onQueryChange(v: string) {
    setQuery(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!v.trim()) { setResults([]); return }
    setSearching(true)
    timerRef.current = setTimeout(async () => {
      try {
        const data = await api.meta.searchGeo(v)
        setResults(Array.isArray(data) ? data : [])
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 400)
  }

  function addLocation(loc: any) {
    if (geo.some(g => g.key === loc.key)) return
    setDraft({ ...draft, geo: [...geo, { key: loc.key, name: loc.name, region: loc.region ?? undefined, radius: 25 }] })
    setQuery(""); setResults([])
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">Geolocalização</h3>
        <p className="text-[13px] text-zinc-500 mt-1">Cidades onde os anúncios serão exibidos.</p>
      </div>
      <div className="relative">
        <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-xl focus-within:ring-violet-500/50 transition-all">
          <MapPin size={13} className="text-zinc-600 shrink-0" />
          <input value={query} onChange={e => onQueryChange(e.target.value)}
            placeholder="Buscar cidade — ex: São Paulo"
            className="flex-1 bg-transparent text-[13px] text-white placeholder-zinc-600 focus:outline-none" />
          {searching && <Loader2 size={13} className="text-zinc-600 animate-spin shrink-0" />}
        </div>
        {results.length > 0 && (
          <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-zinc-900 ring-1 ring-white/[0.1] rounded-xl overflow-hidden shadow-xl">
            {results.slice(0, 6).map(r => (
              <button key={r.key} onClick={() => addLocation(r)}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.06] transition-colors">
                <MapPin size={11} className="text-violet-400 shrink-0" />
                <div>
                  <p className="text-[13px] text-zinc-200">{r.name}</p>
                  {r.region && <p className="text-[11px] text-zinc-600">{r.region} · {r.country_code}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      {geo.length === 0 && <p className="text-[12px] text-zinc-600 text-center py-2">Nenhuma cidade adicionada.</p>}
      <div className="space-y-2">
        {geo.map((loc, i) => (
          <div key={i} className="px-4 py-3 bg-white/[0.03] ring-1 ring-white/[0.07] rounded-xl">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <MapPin size={12} className="text-violet-400" />
                <span className="text-[13px] text-zinc-200 font-medium">{loc.name}</span>
                {loc.region && <span className="text-[11px] text-zinc-600">{loc.region}</span>}
              </div>
              <button onClick={() => setDraft({ ...draft, geo: geo.filter((_, j) => j !== i) })} className="text-zinc-600 hover:text-red-400 transition-colors"><X size={13} /></button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-zinc-600 w-10">Raio:</span>
              <div className="flex gap-1.5">
                {RADII.map(r => (
                  <button key={r} onClick={() => setDraft({ ...draft, geo: geo.map((c, j) => j === i ? { ...c, radius: r } : c) })}
                    className={cn("px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors",
                      loc.radius === r ? "bg-violet-600 text-white" : "bg-white/[0.04] text-zinc-500 hover:text-zinc-300")}>
                    {r}km
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
      <button onClick={onNext} disabled={geo.length === 0}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-semibold rounded-xl transition-colors">
        Próximo
      </button>
    </div>
  )
}

function StepAudience({ draft, setDraft, onNext }: StepProps) {
  const [query,     setQuery]     = useState("")
  const [results,   setResults]   = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const interests        = draft.interests        ?? []
  const includeAudiences = draft.includeAudiences ?? []
  const excludeAudiences = draft.excludeAudiences ?? []
  const advantagePlus    = draft.advantagePlus    ?? false
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onQueryChange(v: string) {
    setQuery(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!v.trim()) { setResults([]); return }
    setSearching(true)
    timerRef.current = setTimeout(async () => {
      try {
        const data = await api.meta.searchInterests(v)
        setResults(Array.isArray(data) ? data : [])
      } catch { setResults([]) }
      finally { setSearching(false) }
    }, 400)
  }

  function addInterest(int: any) {
    if (interests.some(i => i.id === int.id)) return
    setDraft({ ...draft, interests: [...interests, { id: int.id, name: int.name, audience_size: int.audience_size ?? null }] })
    setQuery(""); setResults([])
  }

  function fmtSize(n: number | null | undefined) {
    if (!n) return null
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`
    if (n >= 1_000)     return `${(n / 1_000).toFixed(0)}K`
    return String(n)
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">Público</h3>
        <p className="text-[13px] text-zinc-500 mt-1">Configure quem verá seus anúncios.</p>
      </div>
      <div className="flex items-start gap-3 px-4 py-3.5 bg-white/[0.03] ring-1 ring-white/[0.07] rounded-xl">
        <div className="flex-1">
          <p className="text-[13px] text-zinc-200 font-medium">Advantage+ Audience</p>
          <p className="text-[11px] text-zinc-600 mt-0.5 leading-snug">Meta expande o público além dos parâmetros para maximizar resultados.</p>
        </div>
        <button onClick={() => setDraft({ ...draft, advantagePlus: !advantagePlus })} className={toggleBtn(advantagePlus)}>
          <span className={toggleKnob(advantagePlus)} />
        </button>
      </div>
      <div className="space-y-2">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Interesses</p>
        <div className="relative">
          <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-xl focus-within:ring-violet-500/50 transition-all">
            <input value={query} onChange={e => onQueryChange(e.target.value)}
              placeholder="Buscar interesse — ex: Marketing digital"
              className="flex-1 bg-transparent text-[13px] text-white placeholder-zinc-600 focus:outline-none" />
            {searching && <Loader2 size={13} className="text-zinc-600 animate-spin shrink-0" />}
          </div>
          {results.length > 0 && (
            <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-zinc-900 ring-1 ring-white/[0.1] rounded-xl overflow-hidden shadow-xl">
              {results.slice(0, 6).map(r => (
                <button key={r.id} onClick={() => addInterest(r)}
                  className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left hover:bg-white/[0.06] transition-colors">
                  <div>
                    <p className="text-[13px] text-zinc-200">{r.name}</p>
                    {r.topic && <p className="text-[11px] text-zinc-600">{r.topic}</p>}
                  </div>
                  {r.audience_size && <span className="text-[11px] text-zinc-600 shrink-0">{fmtSize(r.audience_size)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        {interests.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {interests.map((int, i) => (
              <span key={int.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/10 ring-1 ring-violet-500/20 rounded-full text-[12px] text-violet-300">
                {int.name}
                {int.audience_size && <span className="text-[10px] text-zinc-600">{fmtSize(int.audience_size)}</span>}
                <button onClick={() => setDraft({ ...draft, interests: interests.filter((_, j) => j !== i) })} className="hover:text-white"><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Públicos a incluir (lookalike / personalizado)</p>
        <input type="text" placeholder="Nome ou ID do público (opcional)" className={inputCls}
          onKeyDown={e => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v) { setDraft({ ...draft, includeAudiences: [...includeAudiences, v] }); (e.target as HTMLInputElement).value = "" } } }} />
        {includeAudiences.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {includeAudiences.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/8 ring-1 ring-emerald-500/15 rounded-full text-[12px] text-emerald-400">
                {a} <button onClick={() => setDraft({ ...draft, includeAudiences: includeAudiences.filter((_, j) => j !== i) })}><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Excluir públicos</p>
        <input type="text" placeholder="Ex: Clientes existentes, Compradores 180d" className={inputCls}
          onKeyDown={e => { if (e.key === "Enter") { const v = (e.target as HTMLInputElement).value.trim(); if (v) { setDraft({ ...draft, excludeAudiences: [...excludeAudiences, v] }); (e.target as HTMLInputElement).value = "" } } }} />
        {excludeAudiences.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {excludeAudiences.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/8 ring-1 ring-red-500/15 rounded-full text-[12px] text-red-400">
                {a} <button onClick={() => setDraft({ ...draft, excludeAudiences: excludeAudiences.filter((_, j) => j !== i) })}><X size={10} /></button>
              </span>
            ))}
          </div>
        )}
      </div>
      <button onClick={onNext} className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-semibold rounded-xl transition-colors">
        Próximo
      </button>
    </div>
  )
}

function StepPlacement({ draft, setDraft, onNext }: StepProps) {
  const mode     = draft.placement       ?? "advantage_plus"
  const selected = draft.customPlacements ?? []
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">Placement</h3>
        <p className="text-[13px] text-zinc-500 mt-1">O placement afeta significativamente o custo por resultado.</p>
      </div>
      <div className="space-y-2">
        {([
          { id: "advantage_plus" as const, label: "Advantage+ Placements", desc: "Meta distribui pelos melhores placements automaticamente.", rec: true },
          { id: "manual"         as const, label: "Placement manual",       desc: "Escolha exatamente onde seus anúncios aparecem.",           rec: false },
        ]).map(opt => (
          <button key={opt.id} onClick={() => setDraft({ ...draft, placement: opt.id })}
            className={cn("w-full flex items-start gap-3 p-4 rounded-xl ring-1 transition-all text-left relative",
              mode === opt.id ? "bg-violet-500/10 ring-violet-500/30" : "bg-white/[0.03] ring-white/[0.07] hover:bg-white/[0.06]"
            )}>
            {opt.rec && <span className="absolute top-3 right-3 text-[9px] font-bold text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-full">Recomendado</span>}
            <div className={cn("shrink-0 w-2.5 h-2.5 rounded-full mt-1.5", mode === opt.id ? "bg-violet-500" : "bg-zinc-700")} />
            <div>
              <p className={cn("text-[13px] font-semibold", mode === opt.id ? "text-white" : "text-zinc-300")}>{opt.label}</p>
              <p className="text-[11px] text-zinc-600 mt-0.5 leading-snug">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>
      {mode === "manual" && (
        <div className="grid grid-cols-2 gap-1.5">
          {PLACEMENTS.map(p => (
            <button key={p.id} onClick={() => setDraft({ ...draft, customPlacements: selected.includes(p.id) ? selected.filter(x => x !== p.id) : [...selected, p.id] })}
              className={cn("flex items-center gap-2 px-3 py-2.5 rounded-lg ring-1 text-left transition-all",
                selected.includes(p.id) ? "bg-violet-500/10 ring-violet-500/25 text-violet-300" : "bg-white/[0.03] ring-white/[0.06] text-zinc-500 hover:text-zinc-300")}>
              {selected.includes(p.id) ? <Check size={11} className="text-violet-400 shrink-0" /> : <div className="w-3 h-3 rounded ring-1 ring-zinc-700 shrink-0" />}
              <span className="text-[12px] font-medium">{p.label}</span>
            </button>
          ))}
        </div>
      )}
      <button onClick={onNext} disabled={mode === "manual" && selected.length === 0}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-semibold rounded-xl transition-colors">
        Próximo
      </button>
    </div>
  )
}

function StepPixel({ draft, setDraft, onNext }: StepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">Pixel e evento de conversão</h3>
        <p className="text-[13px] text-zinc-500 mt-1">Para rastrear os resultados da campanha.</p>
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">ID do Pixel</label>
        <input type="text" value={draft.pixelId ?? ""} onChange={e => setDraft({ ...draft, pixelId: e.target.value })}
          placeholder="Ex: 1234567890123456" className={cn(inputCls, "font-mono")} />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Evento de rastreamento</label>
        <div className="grid grid-cols-2 gap-1.5">
          {PIXEL_EVENTS.map(ev => (
            <button key={ev.id} onClick={() => setDraft({ ...draft, pixelEvent: ev.id })}
              className={cn("flex items-center gap-2 px-3 py-2.5 rounded-lg ring-1 text-left transition-all",
                draft.pixelEvent === ev.id ? "bg-violet-500/10 ring-violet-500/25 text-violet-300" : "bg-white/[0.03] ring-white/[0.06] text-zinc-500 hover:text-zinc-300")}>
              {draft.pixelEvent === ev.id ? <Check size={11} className="text-violet-400 shrink-0" /> : <div className="w-3 h-3 rounded ring-1 ring-zinc-700 shrink-0" />}
              <span className="text-[12px] font-medium">{ev.label}</span>
            </button>
          ))}
        </div>
      </div>
      <button onClick={onNext} disabled={!draft.pixelId?.trim() || !draft.pixelEvent}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-semibold rounded-xl transition-colors">
        Próximo
      </button>
    </div>
  )
}

function StepCopy({ draft, setDraft, onNext }: StepProps) {
  const copies     = draft.copies ?? [{ primary: "", headline: "", description: "" }, { primary: "", headline: "", description: "" }, { primary: "", headline: "", description: "" }]
  const selected   = draft.selectedCopyIndex ?? 0
  const [genLoading, setGenLoading] = useState(false)
  const [genErr, setGenErr]         = useState("")

  function updateCopy(idx: number, field: keyof typeof copies[0], value: string) {
    setDraft({ ...draft, copies: copies.map((c, i) => i === idx ? { ...c, [field]: value } : c) })
  }

  async function handleGenerate() {
    setGenLoading(true)
    setGenErr("")
    try {
      const data = await api.agent.generateCopy({
        objective: draft.objective, geo: draft.geo, interests: draft.interests,
        budgetType: draft.budgetType, dailyBudget: draft.dailyBudget, cta: draft.cta,
      })
      if (data.copies?.length) setDraft({ ...draft, copies: data.copies, selectedCopyIndex: 0 })
    } catch (e: any) {
      setGenErr(e.message ?? "Erro ao gerar")
    } finally {
      setGenLoading(false)
    }
  }

  const hasContent = copies[selected].primary.trim() || copies[selected].headline.trim()

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-white">Copy do anúncio</h3>
          <p className="text-[13px] text-zinc-500 mt-1">Escreva 1–3 versões de copy para teste A/B.</p>
        </div>
        <button onClick={handleGenerate} disabled={genLoading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-semibold bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/20 hover:bg-violet-500/20 transition-all disabled:opacity-50 shrink-0">
          {genLoading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {genLoading ? "Gerando…" : "Gerar com IA"}
        </button>
      </div>
      {genErr && <p className="text-[12px] text-red-400">{genErr}</p>}
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <button key={i} onClick={() => setDraft({ ...draft, selectedCopyIndex: i })}
            className={cn("flex-1 py-1.5 rounded-lg text-[12px] font-semibold transition-all",
              selected === i ? "bg-violet-600 text-white" : "bg-white/[0.04] text-zinc-600 hover:text-zinc-300")}>
            Versão {i + 1}
          </button>
        ))}
      </div>
      <div className="space-y-2.5">
        <div>
          <label className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider block mb-1.5">Texto principal</label>
          <textarea value={copies[selected].primary} onChange={e => updateCopy(selected, "primary", e.target.value)}
            placeholder="O texto que aparece acima do criativo..." rows={3}
            className={cn(inputCls, "resize-none leading-relaxed")} />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider block mb-1.5">Título</label>
          <input type="text" value={copies[selected].headline} onChange={e => updateCopy(selected, "headline", e.target.value)}
            placeholder="Título curto e direto..." className={inputCls} />
        </div>
        <div>
          <label className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider block mb-1.5">Descrição (opcional)</label>
          <input type="text" value={copies[selected].description} onChange={e => updateCopy(selected, "description", e.target.value)}
            placeholder="Breve descrição abaixo do título..." className={inputCls} />
        </div>
      </div>
      <button onClick={onNext} disabled={!hasContent}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-semibold rounded-xl transition-colors">
        Próximo
      </button>
    </div>
  )
}

function StepCta({ draft, setDraft, onNext }: StepProps) {
  const options = CTA_BY_OBJECTIVE[draft.objective ?? ""] ?? CTA_BY_OBJECTIVE["OUTCOME_LEADS"]
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">Botão de chamada para ação</h3>
        <p className="text-[13px] text-zinc-500 mt-1">CTA exibido no anúncio.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map(opt => (
          <button key={opt.id} onClick={() => setDraft({ ...draft, cta: opt.id })}
            className={cn("p-3.5 rounded-xl ring-1 text-left transition-all",
              draft.cta === opt.id ? "bg-violet-500/10 ring-violet-500/30 text-violet-300" : "bg-white/[0.03] ring-white/[0.07] text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200")}>
            <div className="flex items-center gap-2">
              {draft.cta === opt.id ? <Check size={12} className="text-violet-400 shrink-0" /> : <div className="w-3 h-3 rounded ring-1 ring-zinc-700 shrink-0" />}
              <span className="text-[13px] font-medium">{opt.label}</span>
            </div>
          </button>
        ))}
      </div>
      <button onClick={onNext} disabled={!draft.cta}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-semibold rounded-xl transition-colors">
        Próximo
      </button>
    </div>
  )
}

function StepConversation({ draft, setDraft, onNext }: StepProps) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">Mensagem de boas-vindas</h3>
        <p className="text-[13px] text-zinc-500 mt-1">Mensagem enviada quando o usuário inicia a conversa no WhatsApp.</p>
      </div>
      <textarea value={draft.conversationMessage ?? ""} onChange={e => setDraft({ ...draft, conversationMessage: e.target.value })}
        placeholder="Ex: Olá! Vi seu anúncio e gostaria de saber mais sobre..." rows={4}
        className={cn(inputCls, "resize-none leading-relaxed")} />
      <button onClick={onNext}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-semibold rounded-xl transition-colors">
        Próximo
      </button>
    </div>
  )
}

function StepCreative({ draft, setDraft, onNext }: StepProps) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState("")
  const type    = draft.creativeType ?? "upload"
  const uploaded = !!(draft.creativeHash || draft.creativeVideoId)
  const canNext = type === "upload" ? uploaded : !!(draft.creativeHash?.trim() || draft.creativeVideoId?.trim())

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ""
    if (!f) return
    setUploadErr("")
    setUploading(true)
    try {
      const data = await api.media.upload(f)
      setDraft({
        ...draft,
        creativeName:    f.name,
        creativeHash:    data.meta_hash    ?? undefined,
        creativeVideoId: data.meta_video_id ?? undefined,
      })
    } catch (err: any) {
      setUploadErr(err.message ?? "Erro ao enviar")
    } finally { setUploading(false) }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">Criativo</h3>
        <p className="text-[13px] text-zinc-500 mt-1">Forneça a mídia do anúncio.</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {([
          { id: "upload"   as const, label: "Upload de arquivo", icon: Upload },
          { id: "existing" as const, label: "Hash / Video ID",   icon: Hash },
        ]).map(opt => {
          const Icon = opt.icon
          return (
            <button key={opt.id} onClick={() => setDraft({ ...draft, creativeType: opt.id, creativeHash: undefined, creativeVideoId: undefined, creativeName: undefined })}
              className={cn("flex items-center gap-2.5 p-3.5 rounded-xl ring-1 transition-all",
                type === opt.id ? "bg-violet-500/10 ring-violet-500/30 text-violet-300" : "bg-white/[0.03] ring-white/[0.07] text-zinc-500 hover:text-zinc-300")}>
              <Icon size={14} /><span className="text-[12px] font-semibold">{opt.label}</span>
            </button>
          )
        })}
      </div>
      {type === "upload" && (
        <>
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />
          <button onClick={() => !uploading && fileRef.current?.click()}
            className={cn("w-full flex flex-col items-center justify-center gap-2 py-8 ring-1 ring-dashed rounded-xl transition-colors",
              uploaded ? "bg-emerald-500/5 ring-emerald-500/20" : "bg-white/[0.03] ring-white/[0.12] hover:bg-white/[0.06]"
            )}>
            {uploading ? (
              <><Loader2 size={18} className="text-violet-400 animate-spin" /><p className="text-[12px] text-zinc-400">Enviando para Meta...</p></>
            ) : uploaded ? (
              <><Check size={18} className="text-emerald-400" /><p className="text-[12px] text-emerald-300 font-medium">{draft.creativeName}</p>
              <p className="text-[10px] text-zinc-600">{draft.creativeHash ? `hash: ${draft.creativeHash.slice(0,12)}…` : `video_id: ${draft.creativeVideoId}`}</p></>
            ) : (
              <><Upload size={18} className="text-zinc-500" /><p className="text-[12px] text-zinc-500">Clique para selecionar imagem ou vídeo</p></>
            )}
          </button>
          {uploadErr && (
            <div className="flex items-center gap-2 text-[12px] text-red-400 bg-red-500/10 ring-1 ring-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle size={13} className="shrink-0" /> {uploadErr}
            </div>
          )}
        </>
      )}
      {type === "existing" && (
        <div className="space-y-2.5">
          <div>
            <label className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider block mb-1.5">Image hash</label>
            <input type="text" value={draft.creativeHash ?? ""} onChange={e => setDraft({ ...draft, creativeHash: e.target.value })}
              placeholder="Ex: abc123def456..." className={cn(inputCls, "font-mono text-[12px]")} />
          </div>
          <p className="text-[11px] text-zinc-700 text-center">— ou —</p>
          <div>
            <label className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider block mb-1.5">Video ID</label>
            <input type="text" value={draft.creativeVideoId ?? ""} onChange={e => setDraft({ ...draft, creativeVideoId: e.target.value })}
              placeholder="Ex: 1234567890123456" className={cn(inputCls, "font-mono text-[12px]")} />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-3.5 bg-white/[0.03] ring-1 ring-white/[0.07] rounded-xl">
        <div>
          <p className="text-[13px] text-zinc-200 font-medium">Dynamic Creative</p>
          <p className="text-[11px] text-zinc-600 mt-0.5">Meta combina variações automaticamente.</p>
        </div>
        <button onClick={() => setDraft({ ...draft, dynamicCreative: !draft.dynamicCreative })} className={toggleBtn(!!draft.dynamicCreative)}>
          <span className={toggleKnob(!!draft.dynamicCreative)} />
        </button>
      </div>
      <button onClick={onNext} disabled={!canNext}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-semibold rounded-xl transition-colors">
        Próximo
      </button>
    </div>
  )
}

function StepSchedule({ draft, setDraft, onNext }: StepProps) {
  const alwaysOn = draft.alwaysOn ?? true
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">Programação</h3>
        <p className="text-[13px] text-zinc-500 mt-1">Quando a campanha deve rodar.</p>
      </div>
      <div>
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Data de início</label>
        <input type="date" value={draft.scheduleStart ?? ""} onChange={e => setDraft({ ...draft, scheduleStart: e.target.value })}
          className={inputCls} />
      </div>
      <div className="flex items-center justify-between px-4 py-3.5 bg-white/[0.03] ring-1 ring-white/[0.07] rounded-xl">
        <div>
          <p className="text-[13px] text-zinc-200 font-medium">Sempre ativo</p>
          <p className="text-[11px] text-zinc-600 mt-0.5">Sem data de encerramento.</p>
        </div>
        <button onClick={() => setDraft({ ...draft, alwaysOn: !alwaysOn, scheduleEnd: alwaysOn ? draft.scheduleEnd : undefined })} className={toggleBtn(alwaysOn)}>
          <span className={toggleKnob(alwaysOn)} />
        </button>
      </div>
      {!alwaysOn && (
        <div>
          <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Data de encerramento</label>
          <input type="date" value={draft.scheduleEnd ?? ""} onChange={e => setDraft({ ...draft, scheduleEnd: e.target.value })}
            min={draft.scheduleStart} className={inputCls} />
        </div>
      )}
      <button onClick={onNext} disabled={!draft.scheduleStart}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-semibold rounded-xl transition-colors">
        Próximo
      </button>
    </div>
  )
}

function StepBudget({ draft, setDraft, onNext }: StepProps) {
  const isLifetime = draft.lifetimeBudget ?? false
  const budgetType = draft.budgetType ?? "ABO"
  const total      = (draft.dailyBudget ?? 0) * (draft.adsets ?? 1)
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[16px] font-semibold text-white">Orçamento</h3>
        <p className="text-[13px] text-zinc-500 mt-1">
          {budgetType === "ABO" ? "Valor por conjunto de anúncios." : "Valor total da campanha (CBO)."}
        </p>
      </div>
      <div className="flex gap-2">
        {([{ id: false, label: "Diário" }, { id: true, label: "Total (lifetime)" }] as const).map(opt => (
          <button key={String(opt.id)} onClick={() => setDraft({ ...draft, lifetimeBudget: opt.id })}
            className={cn("flex-1 py-2.5 rounded-xl text-[12px] font-semibold ring-1 transition-all",
              isLifetime === opt.id ? "bg-violet-600 text-white ring-violet-600" : "bg-white/[0.03] text-zinc-500 ring-white/[0.07] hover:text-zinc-300")}>
            {opt.label}
          </button>
        ))}
      </div>
      <div>
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">
          Valor (R$) {budgetType === "ABO" ? "por conjunto" : "total"}
        </label>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 text-[13px] font-medium">R$</span>
          <input type="number" min="1" step="0.01" value={draft.dailyBudget ?? ""} onChange={e => setDraft({ ...draft, dailyBudget: Number(e.target.value) })}
            placeholder="50,00"
            className="w-full pl-10 pr-4 py-3 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-xl text-[14px] text-white placeholder-zinc-600 focus:outline-none focus:ring-violet-500/50 transition-all font-semibold tabular-nums" />
        </div>
        {budgetType === "ABO" && (draft.adsets ?? 1) > 1 && (draft.dailyBudget ?? 0) > 0 && !isLifetime && (
          <p className="text-[11px] text-zinc-600 mt-1.5">Total: R$ {total.toFixed(2).replace(".", ",")} /dia em {draft.adsets} conjuntos</p>
        )}
      </div>
      <button onClick={onNext} disabled={!(draft.dailyBudget && draft.dailyBudget > 0)}
        className="w-full py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white text-[13px] font-semibold rounded-xl transition-colors">
        Revisar campanha →
      </button>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null
  return (
    <div className="flex items-start gap-3 px-4 py-2.5 bg-white/[0.03] ring-1 ring-white/[0.05] rounded-lg">
      <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-wider w-20 shrink-0 mt-0.5">{label}</span>
      <span className="text-[12px] text-zinc-300 flex-1 leading-snug">{value}</span>
    </div>
  )
}

function buildMessage(draft: CampaignDraft): string {
  const fmt        = (n: number) => `R$ ${n.toFixed(2).replace(".", ",")}`
  const budgetType = draft.budgetType ?? "ABO"
  const name       = draft.name ?? `${draft.objectiveLabel?.toUpperCase() ?? "CAMP"}-${new Date().toLocaleString("pt-BR",{month:"short"}).toUpperCase().replace(".","")}`
  const lines: string[] = [
    "Crie uma nova campanha no Meta Ads com as seguintes configurações:\n",
    `**OBJETIVO:** ${draft.objectiveLabel} (${draft.objective})`,
    `**ESTRUTURA:** ${draft.campaigns ?? 1} campanha(s) • ${draft.adsets ?? 1} conjunto(s) • ${draft.ads ?? 1} anúncio(s) por conjunto`,
    `**BUDGET:** ${budgetType} • ${fmt(draft.dailyBudget ?? 0)} ${draft.lifetimeBudget ? "total" : "/dia"} ${budgetType === "ABO" ? "por conjunto" : ""}`,
    `**NOME BASE:** ${name}`,
    "",
  ]
  if ((draft.geo ?? []).length > 0) {
    lines.push("**GEOLOCALIZAÇÃO (use as keys abaixo diretamente, sem chamar search_geo):**")
    draft.geo!.forEach(g => lines.push(`  - key: ${g.key} | nome: ${g.name}${g.region ? ` (${g.region})` : ""} | raio: ${g.radius}km`))
    lines.push("")
  }
  lines.push("**PÚBLICO:**")
  lines.push(`  - Advantage+ Audience: ${draft.advantagePlus ? "Ativado" : "Desativado"}`)
  if ((draft.interests ?? []).length > 0) {
    lines.push("  - Interesses (use os IDs abaixo diretamente, sem chamar search_interests):")
    draft.interests!.forEach(i => lines.push(`    - id: ${i.id} | nome: ${i.name}`))
  }
  if ((draft.includeAudiences ?? []).length > 0) lines.push(`  - Incluir: ${draft.includeAudiences!.join(", ")}`)
  if ((draft.excludeAudiences ?? []).length > 0) lines.push(`  - Excluir: ${draft.excludeAudiences!.join(", ")}`)
  lines.push("")
  lines.push(`**PLACEMENT:** ${draft.placement === "advantage_plus" ? "Advantage+ (automático)" : `Manual: ${(draft.customPlacements ?? []).join(", ")}`}`)
  lines.push("")
  if (draft.pixelId) { lines.push(`**PIXEL:** ${draft.pixelId} • Evento: ${draft.pixelEvent}`); lines.push("") }
  const activeCopy = (draft.copies ?? [])[draft.selectedCopyIndex ?? 0]
  if (activeCopy?.primary || activeCopy?.headline) {
    lines.push("**COPY (versão selecionada):**")
    if (activeCopy.primary)     lines.push(`  Texto principal: "${activeCopy.primary}"`)
    if (activeCopy.headline)    lines.push(`  Título: "${activeCopy.headline}"`)
    if (activeCopy.description) lines.push(`  Descrição: "${activeCopy.description}"`)
    lines.push("")
  }
  const ctaLabel = Object.values(CTA_BY_OBJECTIVE).flat().find(c => c.id === draft.cta)?.label
  if (draft.cta) { lines.push(`**CTA:** ${ctaLabel ?? draft.cta} (${draft.cta})`); lines.push("") }
  if (draft.conversationMessage) { lines.push(`**MENSAGEM BOAS-VINDAS:** "${draft.conversationMessage}"`); lines.push("") }
  lines.push("**CRIATIVO:**")
  if (draft.creativeHash)    lines.push(`  - image_hash: ${draft.creativeHash}`)
  else if (draft.creativeVideoId) lines.push(`  - video_id: ${draft.creativeVideoId}`)
  else if (draft.creativeName)    lines.push(`  - Arquivo: ${draft.creativeName} (sem hash — não criar anúncio até usuário fornecer o hash)`)
  if (draft.dynamicCreative) lines.push("  - Dynamic Creative: Ativado")
  lines.push("")
  lines.push("**PROGRAMAÇÃO:**")
  lines.push(`  - Início: ${draft.scheduleStart}`)
  lines.push(`  - ${draft.alwaysOn ? "Sempre ativo (sem encerramento)" : `Encerramento: ${draft.scheduleEnd}`}`)
  lines.push("")
  lines.push("Apresente a estrutura completa e aguarde minha confirmação antes de executar qualquer chamada à API.")
  return lines.join("\n")
}

function StepReview({ draft, onSubmit, onBack }: { draft: CampaignDraft; onSubmit: (msg: string) => void; onBack: () => void }) {
  const geo         = (draft.geo ?? []).map(g => `${g.name} (${g.radius}km)`).join(", ") || "—"
  const audiences   = `${draft.advantagePlus ? "Advantage+ ativo" : "Manual"}${(draft.interests ?? []).length > 0 ? ` • ${draft.interests!.map(i => i.name).join(", ")}` : ""}`
  const placement   = draft.placement === "advantage_plus" ? "Advantage+ (auto)" : `Manual (${(draft.customPlacements ?? []).length} selecionados)`
  const ctaLabel    = Object.values(CTA_BY_OBJECTIVE).flat().find(c => c.id === draft.cta)?.label ?? draft.cta
  const budgetLabel = `${draft.budgetType} — R$ ${(draft.dailyBudget ?? 0).toFixed(2).replace(".", ",")} ${draft.lifetimeBudget ? "total" : "/dia"}`

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[16px] font-semibold text-white">Revisão</h3>
          <p className="text-[13px] text-zinc-500 mt-0.5">Confirme antes de enviar ao agente.</p>
        </div>
        <button onClick={onBack} className="flex items-center gap-1 text-[12px] text-zinc-600 hover:text-zinc-300 transition-colors">
          <ChevronLeft size={13} /> Editar
        </button>
      </div>
      <div className="space-y-1.5">
        <ReviewRow label="Objetivo"    value={draft.objectiveLabel} />
        <ReviewRow label="Estrutura"   value={`${draft.campaigns ?? 1} campanha × ${draft.adsets ?? 1} conjunto × ${draft.ads ?? 1} anúncio`} />
        <ReviewRow label="Budget"      value={budgetLabel} />
        <ReviewRow label="Nome"        value={draft.name} />
        <ReviewRow label="Localização" value={geo} />
        <ReviewRow label="Público"     value={audiences} />
        <ReviewRow label="Placement"   value={placement} />
        {draft.pixelId && <ReviewRow label="Pixel" value={`${draft.pixelId} → ${draft.pixelEvent}`} />}
        {draft.cta && <ReviewRow label="CTA" value={ctaLabel} />}
        {draft.creativeName && <ReviewRow label="Criativo" value={draft.creativeName} />}
        {draft.creativeHash && <ReviewRow label="Criativo" value={`hash: ${draft.creativeHash.slice(0, 16)}…`} />}
        <ReviewRow label="Início" value={draft.scheduleStart} />
        <ReviewRow label="Fim"    value={draft.alwaysOn ? "Sempre ativo" : draft.scheduleEnd} />
      </div>
      <button onClick={() => onSubmit(buildMessage(draft))}
        className="w-full py-3 bg-violet-600 hover:bg-violet-500 text-white text-[14px] font-bold rounded-xl transition-colors shadow-lg shadow-violet-500/20 flex items-center justify-center gap-2">
        <Sparkles size={15} />
        Criar campanha
      </button>
    </div>
  )
}

// ─── Main WizardPanel ─────────────────────────────────────────────────────────

interface WizardPanelProps {
  onSubmit: (message: string, draft: CampaignDraft) => void
  onClose: () => void
}

export default function WizardPanel({ onSubmit, onClose }: WizardPanelProps) {
  const [step,  setStep]  = useState<WizardStep>("objective")
  const [draft, setDraft] = useState<CampaignDraft>({ campaigns: 1, adsets: 1, ads: 1, alwaysOn: true, placement: "advantage_plus" })

  const steps   = getStepOrder(draft)
  const idx     = steps.indexOf(step)
  const progress = steps.length > 1 ? (idx / (steps.length - 1)) * 100 : 0

  function onNext() { const n = steps[idx + 1]; if (n) setStep(n) }
  function onBack() { const p = steps[idx - 1]; if (p) setStep(p) }
  function handleSubmit(msg: string) { onSubmit(msg, draft); onClose() }

  const stepProps: StepProps = { draft, setDraft, onNext, onBack }

  return (
    <div className="flex flex-col bg-zinc-900/95 backdrop-blur ring-1 ring-white/[0.1] rounded-2xl overflow-hidden shadow-2xl max-h-[75vh]">

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
            <Sparkles size={12} className="text-violet-400" />
          </div>
          <span className="text-[13px] font-semibold text-white">Nova Campanha</span>
          <span className="text-[11px] text-zinc-600">— {STEP_LABELS[step]}</span>
        </div>
        <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors p-1">
          <X size={14} />
        </button>
      </div>

      {/* Progress bar + step indicator */}
      <div className="shrink-0">
        <div className="h-px bg-white/[0.04]">
          <div className="h-full bg-gradient-to-r from-violet-600 to-violet-400 transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between px-5 py-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-violet-400">{STEP_LABELS[step]}</span>
          </div>
          <span className="text-[11px] text-zinc-600 tabular-nums">{idx + 1} / {steps.length}</span>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {step !== "objective" && step !== "review" && (
          <button onClick={onBack} className="flex items-center gap-1 text-[12px] text-zinc-600 hover:text-zinc-300 transition-colors mb-3">
            <ChevronLeft size={13} /> Voltar
          </button>
        )}

        {step === "objective"    && <StepObjective    {...stepProps} />}
        {step === "structure"    && <StepStructure    {...stepProps} />}
        {step === "abo_cbo"      && <StepAboCbo       {...stepProps} />}
        {step === "naming"       && <StepNaming       {...stepProps} />}
        {step === "geo"          && <StepGeo          {...stepProps} />}
        {step === "audience"     && <StepAudience     {...stepProps} />}
        {step === "placement"    && <StepPlacement    {...stepProps} />}
        {step === "pixel"        && <StepPixel        {...stepProps} />}
        {step === "copy"         && <StepCopy         {...stepProps} />}
        {step === "cta"          && <StepCta          {...stepProps} />}
        {step === "conversation" && <StepConversation {...stepProps} />}
        {step === "creative"     && <StepCreative     {...stepProps} />}
        {step === "schedule"     && <StepSchedule     {...stepProps} />}
        {step === "budget"       && <StepBudget       {...stepProps} />}
        {step === "review"       && <StepReview draft={draft} onSubmit={handleSubmit} onBack={onBack} />}
      </div>
    </div>
  )
}
