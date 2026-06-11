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
  MESSAGES:               "mensagens WhatsApp",
}

export async function POST(req: NextRequest) {
  const tenant = await getTenant(req)
  if (!tenant) return unauthorized()

  try {
    const apiKey = await getAnthropicKey()
    const anthropic = new Anthropic({ apiKey })

    const { objective, geo, interests, budgetType, dailyBudget, cta, name, productContext } = await req.json()

    const productLine = productContext?.trim()
      ? `PRODUTO/SERVIÇO: ${productContext}`
      : name?.trim()
        ? `Campanha: ${name}`
        : null

    if (!productLine) {
      return Response.json(
        { error: "Preencha o campo 'Produto / serviço anunciado' para gerar copy relevante." },
        { status: 400 }
      )
    }

    const contextLines = [
      productLine,
      objective   && `Objetivo: ${OBJECTIVE_LABELS[objective] ?? objective}`,
      geo?.length && `Localização alvo: ${geo.map((g: any) => g.name).join(", ")}`,
      interests?.length && `Interesses do público: ${interests.map((i: any) => i.name).join(", ")}`,
      cta         && `CTA do anúncio: ${cta}`,
    ].filter(Boolean).join("\n")

    const msg = await anthropic.messages.create({
      model:      "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{
        role:    "user",
        content: `Você é um redator especialista em performance marketing para Meta Ads no Brasil.

Gere 3 variações de copy para o anúncio abaixo. Cada versão deve ter abordagem diferente: benefício direto, urgência/escassez, prova social ou dor/solução.

DADOS DA CAMPANHA:
${contextLines}

REGRAS OBRIGATÓRIAS:
- Texto principal: max 125 caracteres, foco no benefício ESPECÍFICO do produto, pode usar 1 emoji relevante
- Título: max 40 caracteres, direto ao ponto, com CTA claro e específico ao produto
- Descrição: max 30 caracteres, complemento do título
- PROIBIDO: "Fale conosco", "Entre em contato", "Saiba mais" sozinhos, frases genéricas de atendimento
- OBRIGATÓRIO: mencionar o produto/serviço real na copy
- Tom: direto, sem rodeios, como quem vende de verdade

Retorne APENAS o JSON (sem markdown, sem explicação):
{
  "copies": [
    { "primary": "...", "headline": "...", "description": "..." },
    { "primary": "...", "headline": "...", "description": "..." },
    { "primary": "...", "headline": "...", "description": "..." }
  ]
}`,
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
