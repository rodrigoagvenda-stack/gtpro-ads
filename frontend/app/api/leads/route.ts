import { NextRequest } from "next/server"
import { createServiceClient } from "@/lib/server/supabase"
import { getTenant } from "@/lib/server/auth"

export async function GET(req: NextRequest) {
  const ctx = await getTenant(req)
  if (!ctx) return Response.json({ error: "Não autenticado" }, { status: 401 })
  const tenantId = ctx.tenant_id

  const { searchParams } = req.nextUrl
  const limit  = Math.min(Number(searchParams.get("limit") ?? "200"), 500)
  const preset = searchParams.get("date_preset") ?? "last_30d"

  const since = presetToDate(preset)
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("tenant_id", tenantId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

function presetToDate(preset: string): Date {
  const d = new Date()
  switch (preset) {
    case "today":      d.setHours(0, 0, 0, 0); break
    case "last_7d":    d.setDate(d.getDate() - 7); break
    case "last_30d":   d.setDate(d.getDate() - 30); break
    case "last_90d":   d.setDate(d.getDate() - 90); break
    default:           d.setDate(d.getDate() - 30)
  }
  return d
}
