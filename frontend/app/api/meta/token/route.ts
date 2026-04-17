import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { saveMetaConnection } from "@/lib/server/meta-ads"

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const { access_token, ad_account_id } = await req.json()
  if (!access_token || !ad_account_id) {
    return Response.json({ error: "access_token e ad_account_id são obrigatórios" }, { status: 400 })
  }

  try {
    await saveMetaConnection(tenant.tenant_id, access_token, ad_account_id.replace("act_", ""))
    return Response.json({ success: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 500 })
  }
}
