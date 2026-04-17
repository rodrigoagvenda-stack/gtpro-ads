import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("reports")
    .select("*")
    .eq("tenant_id", tenant.tenant_id)
    .order("created_at", { ascending: false })
  return Response.json(data ?? [])
}
