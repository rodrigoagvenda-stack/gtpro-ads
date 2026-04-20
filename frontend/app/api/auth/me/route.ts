import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function GET(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return unauthorized()

  const supabase = createServiceClient()

  const [memberRes, configRes] = await Promise.all([
    supabase.from("tenant_members").select("role").eq("tenant_id", ctx.tenant_id).single(),
    supabase.from("agent_configs").select("onboarding_completed, user_name").eq("tenant_id", ctx.tenant_id).single(),
  ])

  return Response.json({
    tenant_id: ctx.tenant_id,
    is_admin: memberRes.data?.role === "super_admin",
    onboarding_completed: configRes.data?.onboarding_completed ?? false,
    name: configRes.data?.user_name ?? "",
  })
}
