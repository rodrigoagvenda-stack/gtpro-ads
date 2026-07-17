import { NextRequest } from "next/server"
import { getTenant } from "@/lib/server/auth"
import { getGoogleDeveloperToken } from "@/lib/server/platform"

const ADS_BASE = "https://googleads.googleapis.com/v20"

export async function GET(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return Response.json({ error: "unauthorized" }, { status: 401 })

  const accessToken = req.nextUrl.searchParams.get("access_token")
  if (!accessToken) return Response.json({ error: "pass ?access_token=..." }, { status: 400 })

  const devToken = await getGoogleDeveloperToken()
  const url = `${ADS_BASE}/customers:listAccessibleCustomers`

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "developer-token": devToken,
    },
  })

  const rawBody = await res.text()

  let parsed: unknown = null
  try { parsed = JSON.parse(rawBody) } catch { /* not json */ }

  return Response.json({
    url,
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries(res.headers.entries()),
    body: parsed ?? rawBody,
    devTokenLength: devToken?.length ?? 0,
  })
}
