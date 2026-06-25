import { NextRequest } from "next/server"
import { findFlowsForComment, incrementExecutions } from "@/lib/server/instagram"
import { sendIgDM, replyToComment } from "@/lib/server/instagram"
import { createServiceClient } from "@/lib/server/supabase"

const VERIFY_TOKEN = process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "gtpro_ig_webhook"

// ─── Verification (GET) ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const mode      = searchParams.get("hub.mode")
  const token     = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")
  console.log(`[ig/webhook] GET verify mode=${mode} token_ok=${token === VERIFY_TOKEN}`)
  if (mode === "subscribe" && token === VERIFY_TOKEN)
    return new Response(challenge ?? "ok", { status: 200 })
  return new Response("Forbidden", { status: 403 })
}

// ─── Events (POST) ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: any
  try {
    body = await req.json()
    console.log(`[ig/webhook] POST object=${body.object} entries=${body.entry?.length ?? 0}`)
  } catch (e: any) {
    console.error("[ig/webhook] invalid JSON:", e.message)
    return Response.json({ ok: true })
  }

  if (body.object !== "instagram") {
    console.log(`[ig/webhook] ignored object=${body.object}`)
    return Response.json({ ok: true })
  }

  for (const entry of body.entry ?? []) {
    const igUserId = entry.id as string
    console.log(`[ig/webhook] entry ig_user_id=${igUserId} changes=${entry.changes?.length ?? 0}`)

    for (const change of entry.changes ?? []) {
      console.log(`[ig/webhook] change field=${change.field}`)
      if (change.field !== "comments") continue

      const v = change.value
      const commentId = v.id as string
      const mediaId   = v.media?.id as string
      const text      = (v.text ?? "") as string
      console.log(`[ig/webhook] comment id=${commentId} media=${mediaId} text="${text}"`)

      if (!commentId || !mediaId) {
        console.log("[ig/webhook] skipped: missing commentId or mediaId")
        continue
      }

      const supabase = createServiceClient()
      const { data: acc, error: accErr } = await supabase
        .from("ig_accounts")
        .select("tenant_id, page_access_token")
        .eq("ig_user_id", igUserId)
        .single()

      if (!acc) {
        console.warn(`[ig/webhook] no ig_account found for ig_user_id=${igUserId} err=${accErr?.message}`)
        continue
      }
      console.log(`[ig/webhook] account found tenant_id=${acc.tenant_id} has_token=${!!acc.page_access_token}`)

      const flows = await findFlowsForComment(igUserId, mediaId)
      console.log(`[ig/webhook] flows found: ${flows.length}`)

      for (const flow of flows) {
        if (flow.trigger_type === "keyword" && flow.trigger_keywords?.length) {
          const lower = text.toLowerCase()
          const matches = flow.trigger_keywords.some((kw: string) => lower.includes(kw.toLowerCase()))
          console.log(`[ig/webhook] flow=${flow.id} keyword check: ${matches ? "MATCH" : "NO MATCH"} keywords=${flow.trigger_keywords}`)
          if (!matches) continue
        }

        const pageToken = acc.page_access_token
        console.log(`[ig/webhook] dispatching flow=${flow.id} dm=${flow.action_dm} reply=${flow.action_reply}`)

        if (flow.action_dm && flow.dm_message) {
          sendIgDM(igUserId, commentId, flow.dm_message, pageToken).then(() =>
            console.log(`[ig/webhook] DM sent flow=${flow.id}`)
          ).catch(e =>
            console.error(`[ig/webhook] DM error flow=${flow.id}:`, e.message)
          )
        }
        if (flow.action_reply && flow.reply_message) {
          replyToComment(commentId, flow.reply_message, pageToken).then(() =>
            console.log(`[ig/webhook] reply sent flow=${flow.id}`)
          ).catch(e =>
            console.error(`[ig/webhook] reply error flow=${flow.id}:`, e.message)
          )
        }

        incrementExecutions(flow.id)
      }
    }
  }

  return Response.json({ ok: true })
}
