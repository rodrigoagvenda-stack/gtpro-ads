import { NextRequest } from "next/server"
import { getTenant, unauthorized } from "@/lib/server/auth"
import { getAnthropicKey } from "@/lib/server/platform"
import Anthropic from "@anthropic-ai/sdk"

const OBJECTIVE_LABELS: Record<string, string> = {
  OUTCOME_LEADS:          "captação de leads",
  OUTCOME_SALES:          "conversões / vendas",
  OUTCOME_TRAFFIC:        "tráfego para site",
  OUTCOME_ENGAGEMENT:     "engajamento",
  OUTCOME_AWARENESS:      "alcance / awareness",
  OUTCOME_APP_PROMOTION:  "instalações de app",
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  try {
    const apiKey = await getAnthropicKey()
    const anthropic = new Anthropic({ apiKey })

    const { objective, geo, interests, budgetType, dailyBudget, cta } = await req.json()

    const lines = [
      objective   && `Objetivo: ${OBJECTIVE_LABELS[objective] ?? objective}`,
      geo?.length && `Localização: ${geo.map((g: any) => g.name).join(", ")}`,
      interests?.length && `Interesses do público: ${interests.map((i: any) => i.name).join(", ")}`,
      dailyBudget && `Orçamento: R$${dailyBudget}/dia (${budgetType ?? "ABO"})`,
      cta         && `CTA: ${cta}`,
    ].filter(Boolean).join("\n")

    const msg = await anthropic.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 800,
      messages: [{
        role:    "user",
        content: `Você é um especialista em copy para Meta Ads em português brasileiro.

Crie 3 variações de copy para um anúncio com os seguintes dados:
${lines || "Campanha genérica"}

Retorne APENAS o JSON abaixo (sem markdown, sem explicação):
{
  "copies": [
    { "primary": "texto principal (max 125 chars, pode ter emoji)", "headline": "título impactante (max 40 chars)", "description": "descrição curta (max 30 chars)" },
    { "primary": "...", "headline": "...", "description": "..." },
    { "primary": "...", "headline": "...", "description": "..." }
  ]
}

Regras: linguagem direta, foco no benefício, tom profissional e acessível, sem clichês.`,
      }],
    })

    const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : ""
    const jsonStart = raw.indexOf("{")
    const jsonEnd   = raw.lastIndexOf("}") + 1
    const data = JSON.parse(raw.slice(jsonStart, jsonEnd))
    return Response.json(data)
  } catch (err: any) {
    return Response.json({ error: err.message ?? "Falha ao gerar copies" }, { status: 500 })
  }
}
