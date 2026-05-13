import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL ?? "admin@vendai.pro"

export async function GET(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return unauthorized()

  const supabase = createServiceClient()
  const isSuperAdminEmail = ctx.user_email === SUPER_ADMIN_EMAIL

  const [memberRes, configRes, authUserRes] = await Promise.all([
    supabase.from("tenant_members").select("role").eq("id", ctx.user_id!).eq("tenant_id", ctx.tenant_id).single(),
    supabase.from("agent_configs").select("onboarding_completed, user_name").eq("tenant_id", ctx.tenant_id).single(),
    supabase.auth.admin.getUserById(ctx.user_id!),
  ])

  const currentRole = memberRes.data?.role ?? "owner"
  const isAdmin = currentRole === "super_admin" || isSuperAdminEmail

  // Auto-corrige o role no banco se o email bate mas o role ainda não está atualizado
  if (isSuperAdminEmail && currentRole !== "super_admin" && ctx.user_id) {
    await supabase
      .from("tenant_members")
      .update({ role: "super_admin" })
      .eq("id", ctx.user_id)
  }

  const metaName = authUserRes.data?.user?.user_metadata?.name as string | undefined
  const name = configRes.data?.user_name || metaName || ""

  return Response.json({
    tenant_id: ctx.tenant_id,
    is_admin: isAdmin,
    onboarding_completed: configRes.data?.onboarding_completed ?? false,
    name,
  })
}
