import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"

// GET /api/team/invite/[token] — público, valida token e retorna info do convite
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const supabase = createServiceClient()

  const { data: invite } = await supabase
    .from("invites")
    .select("email, role, expires_at, accepted_at, tenant_id")
    .eq("token", token)
    .single()

  if (!invite) {
    return Response.json({ error: "Convite não encontrado." }, { status: 404 })
  }
  if (invite.accepted_at) {
    return Response.json({ error: "Este convite já foi utilizado." }, { status: 410 })
  }
  if (new Date(invite.expires_at) < new Date()) {
    return Response.json({ error: "Este convite expirou." }, { status: 410 })
  }

  const { data: tenant } = await supabase
    .from("tenants")
    .select("nome")
    .eq("id", invite.tenant_id)
    .single()

  return Response.json({
    email: invite.email,
    role: invite.role,
    tenant_name: tenant?.nome ?? "",
    expires_at: invite.expires_at,
  })
}
