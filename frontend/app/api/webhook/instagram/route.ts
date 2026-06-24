import { NextRequest } from "next/server"
import { findFlowsForComment, incrementExecutions, getPageToken } from "@/lib/server/instagram"
import { sendIgDM, replyToComment } from "@/lib/server/instagram"
import { createServiceClient } from "@/lib/server/supabase"

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "gtpro_ig_webhook"

// ─── Verification (GET) ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode      = searchParams.get("hub.mode")
  const token     = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")
  if (mode === "subscribe" && token === VERIFY_TOKEN)
    return new Response(challenge ?? "ok", { status: 200 })
  return new Response("Forbidden", { status: 403 })
}

// ─── Events (POST) ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    if (body.object !== "instagram") return Response.json({ ok: true })

    for (const entry of body.entry ?? []) {
      const igUserId = entry.id as string
      for (const change of entry.changes ?? []) {
        if (change.field !== "comments") continue
        const v = change.value
        const commentId = v.id as string
        const mediaId   = v.media?.id as string
        const text      = (v.text ?? "") as string

        if (!commentId || !mediaId) continue

        // Find tenant that owns this IG account
        const supabase = createServiceClient()
        const { data: acc } = await supabase
          .from("ig_accounts")
          .select("tenant_id, page_access_token")
          .eq("ig_user_id", igUserId)
          .single()
        if (!acc) continue

        const flows = await findFlowsForComment(igUserId, mediaId)
        for (const flow of flows) {
          // Check keyword match if needed
          if (flow.trigger_type === "keyword" && flow.trigger_keywords?.length) {
            const lower = text.toLowerCase()
            const matches = flow.trigger_keywords.some((kw: string) => lower.includes(kw.toLowerCase()))
            if (!matches) continue
          }

          const pageToken = acc.page_access_token

          if (flow.action_dm && flow.dm_message) {
            sendIgDM(igUserId, commentId, flow.dm_message, pageToken).catch(e =>
              console.error(`[ig/webhook] DM error flow=${flow.id}:`, e.message)
            )
          }
          if (flow.action_reply && flow.reply_message) {
            replyToComment(commentId, flow.reply_message, pageToken).catch(e =>
              console.error(`[ig/webhook] reply error flow=${flow.id}:`, e.message)
            )
          }

          incrementExecutions(flow.id)
        }
      }
    }
  } catch (e: any) {
    console.error("[ig/webhook] error:", e.message)
  }
  return Response.json({ ok: true })
}
