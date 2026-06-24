import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getIgAccounts, syncIgAccounts } from "@/lib/server/instagram"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()
  try {
    const { searchParams } = req.nextUrl
    if (searchParams.get("sync") === "1") {
      const accounts = await syncIgAccounts(tenant.tenant_id)
      return Response.json(accounts)
    }
    const accounts = await getIgAccounts(tenant.tenant_id)
    return Response.json(accounts)
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 })
  }
}
