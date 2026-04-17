import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50)
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("agent_logs")
    .select("*")
    .eq("tenant_id", tenant.tenant_id)
    .order("created_at", { ascending: false })
    .limit(limit)
  return Response.json(data ?? [])
}
