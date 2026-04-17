import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { createServiceClient } from "@/lib/server/supabase"

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  const { id } = await params
  const supabase = createServiceClient()
  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", tenant.tenant_id)
    .single()

  if (!report) return Response.json({ error: "Relatório não encontrado" }, { status: 404 })

  const rows = [
    ["Campo", "Valor"],
    ["Título", report.title],
    ["Período", report.period],
    ["Gerado em", new Date(report.created_at).toLocaleString("pt-BR")],
    [],
    ["Resumo"],
    [report.summary ?? ""],
  ]

  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n")

  return new Response("\uFEFF" + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="relatorio-${id}.csv"`,
    },
  })
}
