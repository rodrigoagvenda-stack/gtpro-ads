"use client"

import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import {
  MessageCircle, Plus, X, Check, Loader2, Trash2, Power, RefreshCw,
  ChevronRight, Image as ImageIcon, Zap, MessageSquare,
  ToggleLeft, ToggleRight, AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface IgAccount { id: string; ig_user_id: string; ig_username: string; ig_name: string; profile_picture_url: string }
interface IgPost    { id: string; caption?: string; media_type: string; media_url?: string; thumbnail_url?: string; timestamp: string; permalink: string }
interface IgFlow {
  id: string; name: string; ig_user_id: string; ig_username?: string
  media_id?: string; media_thumbnail?: string; media_caption?: string
  trigger_type: "any" | "keyword"; trigger_keywords: string[]
  action_dm: boolean; dm_message: string
  action_reply: boolean; reply_message: string
  is_active: boolean; executions: number; created_at: string
}

// ─── Flow builder modal ────────────────────────────────────────────────────────

const STEPS = ["Conta & Post", "Gatilho", "Ações"]

function FlowModal({ onClose, onSaved, editFlow }: {
  onClose: () => void
  onSaved: () => void
  editFlow?: IgFlow
}) {
  const [step, setStep]           = useState<1 | 2 | 3>(1)
  const [accounts, setAccounts]   = useState<IgAccount[]>([])
  const [loadingAcc, setLoadingAcc] = useState(true)
  const [syncingAcc, setSyncingAcc] = useState(false)
  const [selAccount, setSelAccount] = useState<IgAccount | null>(null)
  const [posts, setPosts]         = useState<IgPost[]>([])
  const [loadingPosts, setLoadingPosts] = useState(false)
  const [selPost, setSelPost]     = useState<IgPost | null | "any">(null)  // null=not chosen, "any"=all posts
  const [triggerType, setTriggerType] = useState<"any" | "keyword">(editFlow?.trigger_type ?? "any")
  const [kwInput, setKwInput]     = useState("")
  const [keywords, setKeywords]   = useState<string[]>(editFlow?.trigger_keywords ?? [])
  const [actionDm, setActionDm]   = useState(editFlow?.action_dm ?? true)
  const [dmMsg, setDmMsg]         = useState(editFlow?.dm_message ?? "")
  const [actionReply, setActionReply] = useState(editFlow?.action_reply ?? false)
  const [replyMsg, setReplyMsg]   = useState(editFlow?.reply_message ?? "")
  const [name, setName]           = useState(editFlow?.name ?? "")
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState("")

  useEffect(() => {
    api.instagram.accounts().then((accs: IgAccount[]) => {
      setAccounts(accs ?? [])
      if (editFlow) {
        const found = accs.find((a: IgAccount) => a.ig_user_id === editFlow.ig_user_id)
        if (found) setSelAccount(found)
      }
    }).catch(() => {}).finally(() => setLoadingAcc(false))
  }, [])

  useEffect(() => {
    if (!selAccount) return
    setLoadingPosts(true)
    setPosts([])
    setSelPost(null)
    api.instagram.posts(selAccount.ig_user_id).then((p: IgPost[]) => {
      setPosts(p ?? [])
      if (editFlow?.media_id) {
        const found = p?.find((x: IgPost) => x.id === editFlow.media_id)
        setSelPost(found ?? "any")
      }
    }).catch(() => {}).finally(() => setLoadingPosts(false))
  }, [selAccount])

  async function syncAccounts() {
    setSyncingAcc(true)
    try {
      const accs = await api.instagram.accounts(true)
      setAccounts(accs ?? [])
    } catch (e: any) { setErr(e.message) } finally { setSyncingAcc(false) }
  }

  function addKeyword() {
    const kw = kwInput.trim().toLowerCase()
    if (kw && !keywords.includes(kw)) setKeywords(p => [...p, kw])
    setKwInput("")
  }

  async function save() {
    setErr("")
    if (!name.trim()) return setErr("Dê um nome para a automação")
    if (!selAccount) return setErr("Selecione uma conta Instagram")
    if (selPost === null) return setErr("Selecione um post ou escolha todos os posts")
    if (triggerType === "keyword" && !keywords.length) return setErr("Adicione ao menos uma palavra-chave")
    if (!actionDm && !actionReply) return setErr("Ative ao menos uma ação (DM ou resposta)")
    if (actionDm && !dmMsg.trim()) return setErr("Escreva a mensagem do DM")
    if (actionReply && !replyMsg.trim()) return setErr("Escreva a mensagem de resposta pública")

    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        ig_user_id: selAccount.ig_user_id,
        ig_username: selAccount.ig_username,
        media_id:        selPost === "any" ? null : selPost?.id,
        media_thumbnail: selPost === "any" ? null : (selPost?.thumbnail_url ?? selPost?.media_url ?? null),
        media_caption:   selPost === "any" ? null : (selPost?.caption?.slice(0, 120) ?? null),
        trigger_type: triggerType,
        trigger_keywords: triggerType === "keyword" ? keywords : [],
        action_dm: actionDm,
        dm_message: dmMsg.trim(),
        action_reply: actionReply,
        reply_message: replyMsg.trim(),
      }
      if (editFlow) {
        await api.instagram.updateFlow(editFlow.id, payload)
      } else {
        await api.instagram.createFlow(payload)
      }
      onSaved()
    } catch (e: any) { setErr(e.message) } finally { setSaving(false) }
  }

  const step1Ok = !!selAccount && selPost !== null
  // selAccount sozinho habilita o scroll para escolher o post — step1Ok bloqueia o Próximo
  const step2Ok = triggerType === "any" || keywords.length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[#111113] ring-1 ring-white/[0.08] rounded-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.06] shrink-0">
          <div>
            <p className="text-[14px] font-semibold text-white">{editFlow ? "Editar automação" : "Nova automação"}</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">Comentários no Instagram → DM automático</p>
          </div>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors"><X size={15} /></button>
        </div>

        {/* Steps */}
        <div className="flex items-center px-6 py-3 gap-1 shrink-0">
          {STEPS.map((label, i) => {
            const n = i + 1
            const done = step > n
            const active = step === n
            return (
              <div key={n} className="flex items-center gap-1">
                <div className={cn("w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors",
                  active ? "bg-violet-600 text-white" : done ? "bg-emerald-500/20 text-emerald-400" : "bg-white/[0.06] text-zinc-600"
                )}>
                  {done ? <Check size={9} /> : n}
                </div>
                <span className={cn("text-[11px] font-medium whitespace-nowrap transition-colors",
                  active ? "text-zinc-200" : "text-zinc-600"
                )}>{label}</span>
                {n < STEPS.length && <ChevronRight size={10} className="text-zinc-700 mx-1 shrink-0" />}
              </div>
            )
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

          {/* Nome (sempre visível) */}
          {step === 1 && (
            <div>
              <label className="text-[11px] text-zinc-500 mb-1.5 block">Nome da automação</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: DM pra quem comentar no Reels"
                className="w-full bg-white/[0.04] ring-1 ring-white/[0.07] rounded-lg px-3 py-2 text-[13px] text-white placeholder-zinc-700 focus:outline-none focus:ring-violet-500/50 transition-all" />
            </div>
          )}

          {/* Step 1: Conta + Post */}
          {step === 1 && (
            <>
              {/* Contas */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] text-zinc-500">Conta Instagram</label>
                  <button onClick={syncAccounts} disabled={syncingAcc}
                    className="text-[10px] text-zinc-600 hover:text-violet-400 flex items-center gap-1 transition-colors disabled:opacity-40">
                    <RefreshCw size={10} className={cn(syncingAcc && "animate-spin")} /> Sincronizar
                  </button>
                </div>
                {loadingAcc ? (
                  <div className="flex items-center gap-2 text-zinc-600 text-[12px]"><Loader2 size={12} className="animate-spin" /> Carregando...</div>
                ) : accounts.length === 0 ? (
                  <div className="flex items-center gap-2 text-amber-400 text-[12px] bg-amber-500/10 ring-1 ring-amber-500/20 rounded-lg px-3 py-2.5">
                    <AlertCircle size={13} /> Nenhuma conta Instagram encontrada. Clique em "Sincronizar" ou reconecte a conta Meta.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {accounts.map(acc => (
                      <button key={acc.ig_user_id} onClick={() => setSelAccount(acc)}
                        className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ring-1 text-left transition-all",
                          selAccount?.ig_user_id === acc.ig_user_id ? "bg-violet-600/15 ring-violet-500/40" : "bg-white/[0.02] ring-white/[0.06] hover:bg-white/[0.04]"
                        )}>
                        {acc.profile_picture_url
                          ? <img src={acc.profile_picture_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                          : <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0"><MessageCircle size={14} className="text-white" /></div>
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-zinc-200 truncate">@{acc.ig_username || acc.ig_name}</p>
                          <p className="text-[10px] text-zinc-600">ID: {acc.ig_user_id}</p>
                        </div>
                        {selAccount?.ig_user_id === acc.ig_user_id && <Check size={12} className="text-violet-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selAccount && !selPost && (
                <p className="text-[11px] text-violet-400 mt-1">↓ Agora selecione um post abaixo</p>
              )}

              {/* Posts */}
              {selAccount && (
                <div>
                  <label className="text-[11px] text-zinc-500 mb-2 block">Post</label>
                  {loadingPosts ? (
                    <div className="flex items-center gap-2 text-zinc-600 text-[12px]"><Loader2 size={12} className="animate-spin" /> Carregando posts...</div>
                  ) : (
                    <>
                      {/* Any post option */}
                      <button onClick={() => setSelPost("any")}
                        className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-xl ring-1 text-left transition-all mb-2",
                          selPost === "any" ? "bg-violet-600/15 ring-violet-500/40" : "bg-white/[0.02] ring-white/[0.06] hover:bg-white/[0.04]"
                        )}>
                        <div className="w-10 h-10 rounded-lg bg-white/[0.06] flex items-center justify-center shrink-0">
                          <Zap size={14} className="text-zinc-400" />
                        </div>
                        <div>
                          <p className="text-[12px] font-medium text-zinc-200">Qualquer post</p>
                          <p className="text-[10px] text-zinc-600">Dispara para comentários em qualquer publicação</p>
                        </div>
                        {selPost === "any" && <Check size={12} className="text-violet-400 ml-auto shrink-0" />}
                      </button>
                      {/* Post grid */}
                      {posts.length > 0 && (
                        <div className="grid grid-cols-4 gap-1.5">
                          {posts.map(post => {
                            const thumb = post.thumbnail_url ?? post.media_url
                            const isSelected = selPost !== "any" && selPost !== null && (selPost as IgPost).id === post.id
                            return (
                              <button key={post.id} onClick={() => setSelPost(post)}
                                className={cn("relative aspect-square rounded-lg overflow-hidden ring-2 transition-all",
                                  isSelected ? "ring-violet-500" : "ring-transparent hover:ring-white/20"
                                )}>
                                {thumb
                                  ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                                  : <div className="w-full h-full bg-white/[0.06] flex items-center justify-center"><ImageIcon size={16} className="text-zinc-600" /></div>
                                }
                                {isSelected && (
                                  <div className="absolute inset-0 bg-violet-600/30 flex items-center justify-center">
                                    <Check size={16} className="text-white" />
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Step 2: Gatilho */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-[12px] text-zinc-500">Quando disparar a automação?</p>
              <div className="space-y-2">
                {[
                  { id: "any", label: "Qualquer comentário", desc: "Dispara para todo comentário no post" },
                  { id: "keyword", label: "Comentário com palavra-chave", desc: "Dispara só quando o comentário contiver as palavras definidas" },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setTriggerType(opt.id as any)}
                    className={cn("w-full flex items-start gap-3 px-4 py-3 rounded-xl ring-1 text-left transition-all",
                      triggerType === opt.id ? "bg-violet-600/10 ring-violet-500/30" : "bg-white/[0.02] ring-white/[0.06] hover:bg-white/[0.04]"
                    )}>
                    <div className={cn("w-4 h-4 rounded-full border-2 shrink-0 mt-0.5 transition-all flex items-center justify-center",
                      triggerType === opt.id ? "bg-violet-500 border-violet-500" : "border-zinc-600"
                    )}>
                      {triggerType === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div>
                      <p className={cn("text-[13px] font-medium", triggerType === opt.id ? "text-white" : "text-zinc-300")}>{opt.label}</p>
                      <p className="text-[11px] text-zinc-600 mt-0.5">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              {triggerType === "keyword" && (
                <div>
                  <label className="text-[11px] text-zinc-500 mb-2 block">Palavras-chave (não diferencia maiúsculas)</label>
                  <div className="flex gap-2 mb-2">
                    <input value={kwInput} onChange={e => setKwInput(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword() } }}
                      placeholder="Ex: info, quero, preço"
                      className="flex-1 bg-white/[0.04] ring-1 ring-white/[0.07] rounded-lg px-3 py-2 text-[12px] text-white placeholder-zinc-700 focus:outline-none focus:ring-violet-500/50 transition-all" />
                    <button onClick={addKeyword} className="px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[12px] rounded-lg transition-colors">Adicionar</button>
                  </div>
                  {keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {keywords.map(kw => (
                        <span key={kw} className="flex items-center gap-1 px-2 py-1 bg-violet-600/15 ring-1 ring-violet-500/25 rounded-md text-[11px] text-violet-300">
                          {kw}
                          <button onClick={() => setKeywords(p => p.filter(k => k !== kw))} className="text-violet-500 hover:text-white transition-colors"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Step 3: Ações */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-[12px] text-zinc-500">O que fazer quando o gatilho disparar?</p>

              {/* DM */}
              <div className={cn("rounded-xl ring-1 overflow-hidden transition-all", actionDm ? "ring-violet-500/30 bg-violet-600/[0.06]" : "ring-white/[0.07] bg-white/[0.02]")}>
                <button onClick={() => setActionDm(v => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <MessageSquare size={14} className={cn("shrink-0", actionDm ? "text-violet-400" : "text-zinc-600")} />
                  <div className="flex-1">
                    <p className={cn("text-[13px] font-medium", actionDm ? "text-white" : "text-zinc-400")}>Enviar DM automático</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">Mensagem privada para quem comentou</p>
                  </div>
                  {actionDm ? <ToggleRight size={20} className="text-violet-400 shrink-0" /> : <ToggleLeft size={20} className="text-zinc-600 shrink-0" />}
                </button>
                {actionDm && (
                  <div className="px-4 pb-4">
                    <textarea value={dmMsg} onChange={e => setDmMsg(e.target.value)} rows={4}
                      placeholder="Olá! Vi que você comentou no nosso post. Posso te ajudar? 😊"
                      className="w-full bg-black/30 ring-1 ring-white/[0.08] rounded-lg px-3 py-2.5 text-[12px] text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-violet-500/40 resize-none transition-all leading-relaxed" />
                    <p className="text-[10px] text-zinc-700 mt-1">{dmMsg.length} caracteres</p>
                  </div>
                )}
              </div>

              {/* Reply */}
              <div className={cn("rounded-xl ring-1 overflow-hidden transition-all", actionReply ? "ring-emerald-500/30 bg-emerald-600/[0.05]" : "ring-white/[0.07] bg-white/[0.02]")}>
                <button onClick={() => setActionReply(v => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <MessageCircle size={14} className={cn("shrink-0", actionReply ? "text-emerald-400" : "text-zinc-600")} />
                  <div className="flex-1">
                    <p className={cn("text-[13px] font-medium", actionReply ? "text-white" : "text-zinc-400")}>Responder comentário publicamente</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">Resposta visível a todos no post</p>
                  </div>
                  {actionReply ? <ToggleRight size={20} className="text-emerald-400 shrink-0" /> : <ToggleLeft size={20} className="text-zinc-600 shrink-0" />}
                </button>
                {actionReply && (
                  <div className="px-4 pb-4">
                    <textarea value={replyMsg} onChange={e => setReplyMsg(e.target.value)} rows={3}
                      placeholder="Obrigado pelo comentário! Te enviamos uma mensagem privada 😉"
                      className="w-full bg-black/30 ring-1 ring-white/[0.08] rounded-lg px-3 py-2.5 text-[12px] text-zinc-200 placeholder-zinc-700 focus:outline-none focus:ring-emerald-500/40 resize-none transition-all leading-relaxed" />
                  </div>
                )}
              </div>
            </div>
          )}

          {err && (
            <div className="flex items-center gap-2 text-[12px] text-red-400 bg-red-500/10 ring-1 ring-red-500/20 rounded-lg px-3 py-2">
              <AlertCircle size={12} /> {err}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-6 py-4 border-t border-white/[0.06] shrink-0">
          <button onClick={step === 1 ? onClose : () => { setStep((step - 1) as any); setErr("") }}
            className="flex-1 py-2 text-[13px] text-zinc-400 bg-white/[0.04] ring-1 ring-white/[0.08] rounded-xl hover:bg-white/[0.07] transition-colors">
            {step === 1 ? "Cancelar" : "← Voltar"}
          </button>
          {step < 3 ? (
            <button
              disabled={step === 1 ? !step1Ok : !step2Ok}
              onClick={() => { setErr(""); setStep((step + 1) as any) }}
              className="flex-1 py-2 text-[13px] text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-xl transition-colors font-medium">
              Próximo →
            </button>
          ) : (
            <button onClick={save} disabled={saving}
              className="flex-1 py-2 text-[13px] text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 rounded-xl transition-colors font-medium flex items-center justify-center gap-2">
              {saving ? <><Loader2 size={13} className="animate-spin" /> Salvando...</> : <><Check size={13} /> {editFlow ? "Salvar alterações" : "Criar automação"}</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Flow card ────────────────────────────────────────────────────────────────

function FlowCard({ flow, onToggle, onEdit, onDelete }: {
  flow: IgFlow
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState(false)

  async function handleToggle() {
    setToggling(true)
    try { await onToggle() } finally { setToggling(false) }
  }
  async function handleDelete() {
    if (!confirm(`Excluir "${flow.name}"?`)) return
    setDeleting(true)
    try { await onDelete() } finally { setDeleting(false) }
  }

  return (
    <div className={cn("bg-white/[0.02] ring-1 rounded-xl overflow-hidden transition-all",
      flow.is_active ? "ring-white/[0.07]" : "ring-white/[0.04] opacity-60"
    )}>
      <div className="flex items-center gap-3 px-5 py-3.5">
        {/* Thumbnail */}
        <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 bg-white/[0.06] flex items-center justify-center">
          {flow.media_thumbnail
            ? <img src={flow.media_thumbnail} alt="" className="w-full h-full object-cover" />
            : <Zap size={14} className="text-zinc-600" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium text-zinc-200 truncate">{flow.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-zinc-600">@{flow.ig_username ?? flow.ig_user_id}</span>
            <span className="text-[10px] text-zinc-700">·</span>
            <span className="text-[10px] text-zinc-600">{flow.media_id ? "Post específico" : "Todos os posts"}</span>
            <span className="text-[10px] text-zinc-700">·</span>
            <span className="text-[10px] text-zinc-600">
              {flow.trigger_type === "any" ? "Qualquer comentário" : `Palavra-chave: ${flow.trigger_keywords.slice(0, 2).join(", ")}${flow.trigger_keywords.length > 2 ? "…" : ""}`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] text-zinc-700 tabular-nums">{flow.executions} exec.</span>
          <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center hover:bg-white/[0.06] rounded-lg transition-colors text-zinc-600 hover:text-zinc-300">
            <MessageSquare size={12} />
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="w-7 h-7 flex items-center justify-center hover:bg-red-500/10 rounded-lg transition-colors text-zinc-700 hover:text-red-400 disabled:opacity-40">
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
          </button>
          <button onClick={handleToggle} disabled={toggling}
            className={cn("w-7 h-7 flex items-center justify-center rounded-lg transition-colors disabled:opacity-40",
              flow.is_active ? "text-emerald-400 hover:bg-emerald-500/10" : "text-zinc-600 hover:bg-white/[0.06] hover:text-zinc-300"
            )}>
            {toggling ? <Loader2 size={13} className="animate-spin" /> : <Power size={13} />}
          </button>
        </div>
      </div>
      {/* Action badges */}
      <div className="flex items-center gap-1.5 px-5 pb-3">
        {flow.action_dm && (
          <span className="flex items-center gap-1 text-[10px] text-violet-400 bg-violet-500/10 ring-1 ring-violet-500/20 px-2 py-0.5 rounded-md">
            <MessageSquare size={9} /> DM
          </span>
        )}
        {flow.action_reply && (
          <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-500/20 px-2 py-0.5 rounded-md">
            <MessageCircle size={9} /> Resposta pública
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomacoesPage() {
  const [flows, setFlows]         = useState<IgFlow[]>([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editFlow, setEditFlow]   = useState<IgFlow | undefined>(undefined)

  function load() {
    api.instagram.flows().then((f: IgFlow[]) => setFlows(f ?? [])).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function openNew()  { setEditFlow(undefined); setShowModal(true) }
  function openEdit(f: IgFlow) { setEditFlow(f); setShowModal(true) }

  async function handleToggle(flow: IgFlow) {
    await api.instagram.toggleFlow(flow.id, !flow.is_active)
    setFlows(p => p.map(f => f.id === flow.id ? { ...f, is_active: !f.is_active } : f))
  }

  async function handleDelete(flow: IgFlow) {
    await api.instagram.deleteFlow(flow.id)
    setFlows(p => p.filter(f => f.id !== flow.id))
  }

  return (
    <div className="space-y-6">
      {showModal && (
        <FlowModal
          editFlow={editFlow}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-white">Automações Instagram</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5">Comentários → DM automático, estilo ManyChat</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-medium rounded-lg transition-colors">
          <Plus size={13} /> Nova automação
        </button>
      </div>

      {/* Webhook info */}
      <div className="bg-white/[0.02] ring-1 ring-white/[0.06] rounded-xl px-5 py-4">
        <p className="text-[12px] font-semibold text-zinc-300 mb-1">URL do Webhook Instagram</p>
        <p className="text-[11px] text-zinc-600 mb-2">Configure no Meta Developer Console → Webhooks → Instagram → campo <code className="text-violet-400 bg-violet-500/10 px-1 rounded">comments</code></p>
        <code className="text-[11px] text-zinc-400 font-mono bg-white/[0.04] ring-1 ring-white/[0.07] rounded-lg px-3 py-2 block select-all">
          {typeof window !== "undefined" ? window.location.origin : "https://gtpro.vendai.pro"}/api/webhook/instagram
        </code>
        <p className="text-[10px] text-zinc-700 mt-2">Verify token: <code className="text-zinc-500">gtpro_ig_webhook</code> (ou o valor da variável <code className="text-zinc-500">INSTAGRAM_WEBHOOK_VERIFY_TOKEN</code>)</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-zinc-600 text-[13px]"><Loader2 size={13} className="animate-spin" /> Carregando automações...</div>
      ) : flows.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <div className="w-12 h-12 rounded-full bg-white/[0.04] flex items-center justify-center">
            <MessageCircle size={20} className="text-zinc-600" />
          </div>
          <div className="text-center">
            <p className="text-[13px] text-zinc-400">Nenhuma automação criada</p>
            <p className="text-[12px] text-zinc-600 mt-0.5">Crie sua primeira automação de comentários no Instagram.</p>
          </div>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[13px] font-medium rounded-lg transition-colors">
            <Plus size={13} /> Criar primeira automação
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {flows.map(flow => (
            <FlowCard
              key={flow.id}
              flow={flow}
              onToggle={() => handleToggle(flow)}
              onEdit={() => openEdit(flow)}
              onDelete={() => handleDelete(flow)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
