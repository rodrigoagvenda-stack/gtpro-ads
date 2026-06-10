import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"
import { decrypt } from "@/lib/server/crypto"

const GRAPH = "https://graph.facebook.com/v25.0"

async function getTokenAndAccount(tenantId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("meta_connections")
    .select("access_token_encrypted, ad_account_id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single()
  if (!data) throw new Error("Conta Meta não conectada")
  return { token: decrypt(data.access_token_encrypted), adAccountId: data.ad_account_id }
}

// GET — list saved media assets
export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const supabase = createServiceClient()
  const { data } = await supabase
    .from("media_assets")
    .select("*")
    .eq("tenant_id", tenant.tenant_id)
    .order("created_at", { ascending: false })
    .limit(100)

  return Response.json(data ?? [])
}

// POST — upload image or video to Meta + save to media_assets
export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  try {
    const formData = await req.formData()
    const file     = formData.get("file") as File | null
    const name     = (formData.get("name") as string | null) ?? file?.name ?? "media"

    if (!file) return Response.json({ error: "Campo 'file' obrigatório" }, { status: 400 })

    const isVideo = file.type.startsWith("video/")
    const isImage = file.type.startsWith("image/")
    if (!isVideo && !isImage) return Response.json({ error: "Apenas imagens e vídeos são aceitos" }, { status: 400 })

    const { token, adAccountId } = await getTokenAndAccount(tenant.tenant_id)
    const accountId = adAccountId.replace("act_", "")

    const bytes   = await file.arrayBuffer()
    const buffer  = Buffer.from(bytes)
    const payload = new FormData()

    let metaHash: string | null = null
    let metaVideoId: string | null = null

    if (isImage) {
      payload.append("bytes", buffer.toString("base64"))
      payload.append("name", name)
      payload.append("access_token", token)

      const res = await fetch(`${GRAPH}/act_${accountId}/adimages`, {
        method: "POST",
        body: payload,
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        const msg = json.error?.message ?? json.error?.error_user_msg ?? `Meta API retornou ${res.status}`
        return Response.json({ error: msg }, { status: 422 })
      }
      const imgData = Object.values(json.images ?? {})[0] as any
      metaHash = imgData?.hash ?? null
      if (!metaHash) return Response.json({ error: "Meta não retornou hash da imagem" }, { status: 422 })
    } else {
      payload.append("source", new Blob([buffer], { type: file.type }), file.name)
      payload.append("name", name)
      payload.append("access_token", token)

      const res = await fetch(`${GRAPH}/act_${accountId}/advideos`, {
        method: "POST",
        body: payload,
      })
      const json = await res.json()
      if (!res.ok || json.error) {
        const msg = json.error?.message ?? json.error?.error_user_msg ?? `Meta API retornou ${res.status}`
        return Response.json({ error: msg }, { status: 422 })
      }
      metaVideoId = json.id ?? null
      if (!metaVideoId) return Response.json({ error: "Meta não retornou ID do vídeo" }, { status: 422 })
    }

    const supabase = createServiceClient()
    const { data: asset, error } = await supabase
      .from("media_assets")
      .insert({
        tenant_id:     tenant.tenant_id,
        name,
        type:          isImage ? "image" : "video",
        meta_hash:     metaHash,
        meta_video_id: metaVideoId,
        file_size:     file.size,
      })
      .select()
      .single()

    if (error) return Response.json({ error: error.message }, { status: 500 })

    return Response.json({
      id:            asset.id,
      name:          asset.name,
      type:          asset.type,
      meta_hash:     metaHash,
      meta_video_id: metaVideoId,
    })
  } catch (err: any) {
    return Response.json({ error: err.message ?? "Erro interno no servidor" }, { status: 500 })
  }
}
