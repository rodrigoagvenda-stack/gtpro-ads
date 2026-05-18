import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { runAgent } from "@/lib/server/agent"
import { createServiceClient } from "@/lib/server/supabase"

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  try {
    const { message, model, history } = await req.json()
    const supabase = createServiceClient()

    const [configRes, connRes] = await Promise.all([
      supabase.from("agent_configs").select("*").eq("tenant_id", tenant.tenant_id).single(),
      supabase.from("meta_connections").select("ad_account_id").eq("tenant_id", tenant.tenant_id).eq("active", true).eq("is_active", true).single(),
    ])

    const adAccountId = connRes.data?.ad_account_id ?? undefined
    const result = await runAgent(tenant.tenant_id, message, configRes.data ?? {}, model, history, adAccountId)
    return Response.json(result)
  } catch (e: any) {
    const msg: string = e?.message ?? String(e)

    if (msg.includes("Conta Meta não conectada"))
      return Response.json({ error: "Conta Meta não conectada. Configure em Configurações → Meta Ads." }, { status: 400 })
    if (msg.includes("Token Meta expirado") || msg.includes("Token Meta inválido") || msg.includes("Token sem permissão"))
      return Response.json({ error: msg }, { status: 401 })
    if (msg.includes("Permissão negada"))
      return Response.json({ error: msg }, { status: 403 })
    if (msg.toLowerCase().includes("overloaded") || msg.toLowerCase().includes("529"))
      return Response.json({ error: "Serviço de IA temporariamente sobrecarregado. Tente em instantes." }, { status: 503 })

    console.error("[gtpro/query]", msg)
    return Response.json({ error: "Erro interno. Tente novamente." }, { status: 500 })
  }
}
