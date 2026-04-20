import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function POST(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return unauthorized()

  const supabase = createServiceClient()
  await supabase
    .from("agent_configs")
    .update({ onboarding_completed: true })
    .eq("tenant_id", ctx.tenant_id)

  return Response.json({ ok: true })
}
