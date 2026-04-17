import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("meta_connections")
    .select("active, expires_at")
    .eq("tenant_id", tenant.tenant_id)
    .single()
  return Response.json({
    meta_connected: !!data?.active,
    meta_expires_at: data?.expires_at ?? null,
    agent_status: "online",
  })
}
