import { NextRequest, NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { createServiceClient } from "@/lib/server/supabase"
import { getMetaAppSecret } from "@/lib/server/platform"

function verifySignedRequest(signedRequest: string, appSecret: string): Record<string, any> | null {
  const [encodedSig, payload] = signedRequest.split(".")
  if (!encodedSig || !payload) return null

  // Base64url → Base64 → Buffer
  const sig     = Buffer.from(encodedSig.replace(/-/g, "+").replace(/_/g, "/"), "base64")
  const data    = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64")
  const expected = createHmac("sha256", appSecret).update(payload).digest()

  if (!timingSafeEqual(sig, expected)) return null

  try { return JSON.parse(data.toString("utf8")) }
  catch { return null }
}

export async function POST(req: NextRequest) {
  try {
    const appSecret = await getMetaAppSecret()
    if (!appSecret) {
      console.error("[meta/data-deletion] meta_app_secret não configurado em Configurações")
      return NextResponse.json({ error: "misconfiguration" }, { status: 500 })
    }

    // Meta envia como application/x-www-form-urlencoded
    const body = await req.text()
    const params = new URLSearchParams(body)
    const signedRequest = params.get("signed_request")

    if (!signedRequest) {
      return NextResponse.json({ error: "missing signed_request" }, { status: 400 })
    }

    const payload = verifySignedRequest(signedRequest, appSecret)
    if (!payload) {
      console.error("[meta/data-deletion] assinatura inválida")
      return NextResponse.json({ error: "invalid signature" }, { status: 403 })
    }

    const userId = payload.user_id as string | undefined
    if (!userId) {
      return NextResponse.json({ error: "missing user_id" }, { status: 400 })
    }

    console.log(`[meta/data-deletion] solicitação recebida para facebook_user_id=${userId}`)

    // Gera um código de confirmação único
    const confirmationCode = `gdel_${userId}_${Date.now()}`

    // Remove tokens e conexões Meta vinculadas a esse facebook_user_id
    const supabase = createServiceClient()

    // Registra a solicitação de exclusão para auditoria e acompanhamento
    try {
      await supabase.from("data_deletion_requests").insert({
        facebook_user_id: userId,
        confirmation_code: confirmationCode,
        status: "pending",
        requested_at: new Date().toISOString(),
      }).throwOnError()
    } catch {
      console.warn("[meta/data-deletion] tabela data_deletion_requests não encontrada, prosseguindo sem registro")
    }

    // Remove conexões Meta cujo facebook_user_id corresponde
    // (campo opcional — depende de como o tenant armazena o vínculo com o usuário Meta)
    const { error: delError } = await supabase
      .from("meta_connections")
      .delete()
      .eq("facebook_user_id", userId)

    if (delError) {
      console.warn(`[meta/data-deletion] nenhuma conexão encontrada para facebook_user_id=${userId}: ${delError.message}`)
    } else {
      console.log(`[meta/data-deletion] conexões removidas para facebook_user_id=${userId}`)
    }

    // Resposta obrigatória pela Meta: url de status + confirmation_code
    return NextResponse.json({
      url: `https://gtpro.vendai.pro/exclusao-de-dados/status?code=${confirmationCode}`,
      confirmation_code: confirmationCode,
    })
  } catch (err) {
    console.error("[meta/data-deletion] erro interno:", err)
    return NextResponse.json({ error: "internal error" }, { status: 500 })
  }
}

// GET opcional — permite que a Meta verifique se o endpoint está ativo
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "meta-data-deletion" })
}
