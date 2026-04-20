import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "admin@vendai.pro"

async function requireAdmin(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return null
  if (ctx.user_email === SUPER_ADMIN_EMAIL) return ctx
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("tenant_members")
    .select("role")
    .eq("tenant_id", ctx.tenant_id)
    .single()
  if (data?.role !== "super_admin") return null
  return ctx
}

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req)
  if (!ctx) return Response.json({ error: "Não autorizado" }, { status: 403 })

  const supabase = createServiceClient()

  const { data: members } = await supabase
    .from("tenant_members")
    .select("id, tenant_id, role, created_at")

  if (!members?.length) return Response.json([])

  const tenantIds = members.map(m => m.tenant_id)
  const userIds   = members.map(m => m.id)

  const [tenantsRes, configsRes, usersRes] = await Promise.all([
    supabase.from("tenants").select("id, nome, created_at").in("id", tenantIds),
    supabase.from("agent_configs").select("tenant_id, onboarding_completed, user_name").in("tenant_id", tenantIds),
    supabase.auth.admin.listUsers(),
  ])

  const tenantMap  = Object.fromEntries((tenantsRes.data ?? []).map(t => [t.id, t]))
  const configMap  = Object.fromEntries((configsRes.data ?? []).map(c => [c.tenant_id, c]))
  const userMap    = Object.fromEntries((usersRes.data?.users ?? []).filter(u => userIds.includes(u.id)).map(u => [u.id, u]))

  const result = members.map(m => ({
    user_id:              m.id,
    tenant_id:            m.tenant_id,
    role:                 m.role,
    nome:                 tenantMap[m.tenant_id]?.nome ?? "—",
    email:                userMap[m.id]?.email ?? "—",
    onboarding_completed: configMap[m.tenant_id]?.onboarding_completed ?? false,
    created_at:           tenantMap[m.tenant_id]?.created_at ?? m.created_at,
  }))

  return Response.json(result)
}
