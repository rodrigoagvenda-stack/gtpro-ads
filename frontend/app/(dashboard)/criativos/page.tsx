"use client"

import { useEffect, useState, useRef } from "react"
import { api } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  Upload, Film, Image as ImageIcon, Trash2, Copy, Check,
  RefreshCw, ImageOff, X, Plus,
} from "lucide-react"

interface MediaAsset {
  id: string
  name: string
  type: "image" | "video"
  meta_hash: string | null
  meta_video_id: string | null
  file_size: number | null
  created_at: string
}

function formatBytes(b: number | null) {
  if (!b) return null
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  function handle() {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <button onClick={handle}
      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-white/[0.07] text-zinc-400 hover:text-white transition-all max-w-full group">
      <span className="truncate">{value}</span>
      {copied
        ? <Check size={9} className="text-emerald-400 shrink-0" />
        : <Copy size={9} className="text-zinc-600 group-hover:text-zinc-300 shrink-0" />}
    </button>
  )
}

export default function CriativosPage() {
  const [assets, setAssets]       = useState<MediaAsset[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [dragOver, setDragOver]   = useState(false)
  const [filter, setFilter]       = useState<"all" | "image" | "video">("all")
  const fileRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    try {
      const data = await api.media.list()
      setAssets(Array.isArray(data) ? data : [])
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  async function handleUpload(file: File) {
    if (uploading) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", file)
      form.append("name", file.name)
      const { createClient } = await import("@/lib/supabase")
      const token = (await createClient().auth.getSession()).data.session?.access_token
      const res = await fetch("/api/meta/media", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      await load()
    } catch (e: any) {
      alert(`Erro no upload: ${e.message}`)
    } finally { setUploading(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remover da biblioteca? O criativo ainda existirá na conta Meta.")) return
    setDeleting(id)
    try { await api.media.delete(id); setAssets(p => p.filter(a => a.id !== id)) }
    catch (e: any) { alert(`Erro: ${e.message}`) }
    finally { setDeleting(null) }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  const filtered = filter === "all" ? assets : assets.filter(a => a.type === filter)

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[17px] font-semibold text-white">Criativos</h1>
          <p className="text-[12px] text-zinc-600 mt-0.5">Imagens e vídeos enviados para o Meta Ads</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.04] transition-colors disabled:opacity-40">
            <RefreshCw size={12} className={cn(loading && "animate-spin")} />
          </button>
          <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = "" }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[12px] font-medium rounded-lg transition-colors disabled:opacity-50">
            {uploading
              ? <><RefreshCw size={12} className="animate-spin" /> Enviando…</>
              : <><Plus size={12} /> Adicionar mídia</>}
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {[
          { id: "all",   label: `Todos (${assets.length})` },
          { id: "image", label: `Imagens (${assets.filter(a => a.type === "image").length})` },
          { id: "video", label: `Vídeos (${assets.filter(a => a.type === "video").length})` },
        ].map(tab => (
          <button key={tab.id} onClick={() => setFilter(tab.id as any)}
            className={cn("px-3 py-1 rounded-full text-[11px] font-medium transition-colors",
              filter === tab.id ? "bg-violet-600 text-white" : "bg-white/[0.04] text-zinc-500 hover:text-zinc-300 ring-1 ring-white/[0.06]"
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-10 cursor-pointer transition-all",
          dragOver ? "border-violet-500/60 bg-violet-500/5" : "border-white/[0.08] hover:border-white/[0.15] hover:bg-white/[0.02]"
        )}>
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
          dragOver ? "bg-violet-500/20" : "bg-white/[0.04]")}>
          <Upload size={18} className={cn(dragOver ? "text-violet-400" : "text-zinc-600")} />
        </div>
        <div className="text-center">
          <p className="text-[13px] text-zinc-400">Arraste imagens ou vídeos aqui</p>
          <p className="text-[11px] text-zinc-600 mt-0.5">JPG, PNG, MP4, MOV · Enviado diretamente para o Meta Ads</p>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-1.5 text-zinc-600 text-[13px]">
            <RefreshCw size={14} className="animate-spin" />
            Carregando...
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.07] flex items-center justify-center">
            <ImageOff size={20} className="text-zinc-700" />
          </div>
          <div>
            <p className="text-[14px] font-medium text-zinc-400">Nenhuma mídia ainda</p>
            <p className="text-[12px] text-zinc-600 mt-1">Use o botão acima ou arraste um arquivo para começar.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(asset => (
            <div key={asset.id}
              className="group bg-white/[0.02] ring-1 ring-white/[0.07] rounded-xl overflow-hidden hover:ring-white/[0.13] transition-all">

              {/* Thumbnail area */}
              <div className="h-36 bg-zinc-900 flex items-center justify-center relative">
                {asset.type === "video"
                  ? <Film size={32} className="text-zinc-700" />
                  : <ImageIcon size={32} className="text-zinc-700" />}
                <span className={cn(
                  "absolute top-2 left-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider",
                  asset.type === "video" ? "bg-violet-600/80 text-white" : "bg-emerald-600/80 text-white"
                )}>
                  {asset.type === "video" ? "VÍD" : "IMG"}
                </span>
                <button
                  onClick={() => handleDelete(asset.id)}
                  disabled={deleting === asset.id}
                  className="absolute top-2 right-2 w-6 h-6 rounded-md bg-zinc-900/90 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all disabled:opacity-50">
                  {deleting === asset.id
                    ? <RefreshCw size={11} className="text-zinc-500 animate-spin" />
                    : <Trash2 size={11} className="text-zinc-500 hover:text-red-400" />}
                </button>
              </div>

              {/* Info */}
              <div className="p-3 space-y-2">
                <p className="text-[12px] font-medium text-zinc-200 truncate" title={asset.name}>
                  {asset.name}
                </p>

                {/* Hash / Video ID */}
                {asset.meta_hash && (
                  <div>
                    <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">image_hash</p>
                    <CopyButton value={asset.meta_hash} />
                  </div>
                )}
                {asset.meta_video_id && (
                  <div>
                    <p className="text-[9px] text-zinc-600 uppercase tracking-wider mb-1">video_id</p>
                    <CopyButton value={asset.meta_video_id} />
                  </div>
                )}

                {/* Meta */}
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[10px] text-zinc-700">
                    {new Date(asset.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                  </span>
                  {formatBytes(asset.file_size) && (
                    <span className="text-[10px] text-zinc-700">{formatBytes(asset.file_size)}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
