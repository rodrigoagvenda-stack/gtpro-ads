import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const { name } = await req.json()
  const supabase = createServiceClient()

  await supabase
    .from("meta_connections")
    .update({ name })
    .eq("id", params.id)
    .eq("tenant_id", tenant.tenant_id)

  return Response.json({ success: true })
}
