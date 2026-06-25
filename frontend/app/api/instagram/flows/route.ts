import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getFlows, createFlow, getPageToken, subscribePageToComments, getIgAccounts } from "@/lib/server/instagram"
import { createServiceClient } from "@/lib/server/supabase"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const flows = await getFlows(tenant.tenant_id)
    return Response.json(flows)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const body = await req.json()
    const { name, ig_user_id, media_id, media_thumbnail, media_caption,
            trigger_type, trigger_keywords, action_dm, dm_message,
            action_reply, reply_message, ig_username } = body

    if (!name || !ig_user_id) return Response.json({ error: "name e ig_user_id obrigatórios" }, { status: 400 })
    if (action_dm && !dm_message?.trim()) return Response.json({ error: "Mensagem do DM não pode estar vazia" }, { status: 400 })
    if (action_reply && !reply_message?.trim()) return Response.json({ error: "Mensagem de resposta não pode estar vazia" }, { status: 400 })

    const flow = await createFlow(tenant.tenant_id, {
      name, ig_user_id, ig_username: ig_username ?? null,
      media_id: media_id ?? null, media_thumbnail: media_thumbnail ?? null, media_caption: media_caption ?? null,
      trigger_type: trigger_type ?? "any",
      trigger_keywords: trigger_keywords ?? [],
      action_dm: action_dm ?? true,
      dm_message: dm_message ?? "",
      action_reply: action_reply ?? false,
      reply_message: reply_message ?? "",
    })

    // Subscribe page to comment webhooks (best-effort)
    try {
      const supabase = createServiceClient()
      const { data: acc } = await supabase
        .from("ig_accounts")
        .select("page_id, page_access_token")
        .eq("tenant_id", tenant.tenant_id)
        .eq("ig_user_id", ig_user_id)
        .single()
      if (acc?.page_access_token) {
        const subResult = await subscribePageToComments(acc.page_id, acc.page_access_token)
        console.log(`[ig/flows] subscribePageToComments page=${acc.page_id} result=`, JSON.stringify(subResult))
      } else {
        console.warn(`[ig/flows] no page_access_token for ig_user_id=${ig_user_id} — skipping webhook subscribe`)
      }
    } catch (e: any) {
      console.error("[ig/flows] subscribePageToComments error:", e.message)
    }

    return Response.json(flow, { status: 201 })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
