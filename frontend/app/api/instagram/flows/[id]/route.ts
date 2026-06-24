import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { updateFlow, deleteFlow } from "@/lib/server/instagram"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const { id } = await params
  try {
    const body = await req.json()
    const flow = await updateFlow(tenant.tenant_id, id, body)
    return Response.json(flow)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  const { id } = await params
  try {
    await deleteFlow(tenant.tenant_id, id)
    return Response.json({ success: true })
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
