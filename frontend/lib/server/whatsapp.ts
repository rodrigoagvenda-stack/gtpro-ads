import { createServiceClient } from "./supabase"

async function getPlatformSetting(key: string): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase.from("platform_settings").select("value_encrypted").eq("key", key).single()
  return data?.value_encrypted ?? ""
}

async function getUazapiConfig() {
  const [baseUrl, token, instance] = await Promise.all([
    getPlatformSetting("whatsapp_uazapi_url"),
    getPlatformSetting("whatsapp_uazapi_key"),
    getPlatformSetting("whatsapp_uazapi_instance"),
  ])
  return { baseUrl, token, instance }
}

// ─── Public send helpers (UazAPI) ─────────────────────────────────────────────

export async function sendText(to: string, text: string): Promise<boolean> {
  const { baseUrl, token } = await getUazapiConfig()
  if (!baseUrl || !token) return false

  const res = await fetch(`${baseUrl}/send/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "token": token },
    body: JSON.stringify({ number: to, text }),
  })
  if (!res.ok) console.error("[sendText] error:", await res.text().catch(() => ""))
  return res.ok
}

export async function sendButtons(
  to: string,
  text: string,
  buttons: { id: string; label: string }[]
): Promise<boolean> {
  const { baseUrl, token } = await getUazapiConfig()
  if (!baseUrl || !token) return false

  // UazAPI format: "label|id"
  const choices = buttons.map(b => `${b.label}|${b.id}`)

  const res = await fetch(`${baseUrl}/send/menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "token": token },
    body: JSON.stringify({ number: to, type: "button", text, choices }),
  })

  if (res.ok) return true

  const errText = await res.text().catch(() => "")
  console.error("[sendButtons] failed, fallback text. error:", errText)

  // Fallback: texto numerado
  const lines = buttons.map((b, i) => `${i + 1}. ${b.label}`).join("\n")
  return sendText(to, `${text}\n\n${lines}\n\n_Responda com o número da opção_`)
}

export async function sendList(
  to: string,
  text: string,
  buttonText: string,
  rows: { id: string; title: string; subtitle?: string }[]
): Promise<boolean> {
  const { baseUrl, token } = await getUazapiConfig()
  if (!baseUrl || !token) return false

  // UazAPI list format: "[Seção]" + "título|id|descrição"
  const choices = ["[Opções]", ...rows.map(r => `${r.title}|${r.id}|${r.subtitle ?? ""}`)]

  const res = await fetch(`${baseUrl}/send/menu`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "token": token },
    body: JSON.stringify({ number: to, type: "list", text, choices, listButton: buttonText }),
  })

  if (res.ok) return true

  const errText = await res.text().catch(() => "")
  console.error("[sendList] failed, fallback text. error:", errText)

  const lines = rows.map((r, i) => `${i + 1}. ${r.title}`).join("\n")
  return sendText(to, `${text}\n\n${lines}\n\n_Responda com o número da opção_`)
}

// ─── Alert dispatch ───────────────────────────────────────────────────────────

export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const provider = await getPlatformSetting("whatsapp_provider")
  if (!provider || !to) return false

  const phone = to.replace(/\D/g, "")

  if (provider === "uazapi") {
    return sendText(phone, message)
  }

  if (provider === "official") {
    const token   = await getPlatformSetting("whatsapp_official_token")
    const phoneId = await getPlatformSetting("whatsapp_official_phone_id")
    if (!token || !phoneId) return false

    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body: message } }),
    })
    return res.ok
  }

  return false
}

// ─── QR Code ─────────────────────────────────────────────────────────────────

export async function getUazapiQR(): Promise<{ qr: string | null; status: string }> {
  const { baseUrl, token, instance } = await getUazapiConfig()
  if (!baseUrl || !token || !instance) return { qr: null, status: "not_configured" }

  const statusRes = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
    headers: { "token": token },
  }).then(r => r.json()).catch(() => ({}))

  const state = statusRes?.instance?.state ?? statusRes?.state
  if (state === "open") return { qr: null, status: "connected" }

  const qrRes = await fetch(`${baseUrl}/instance/connect/${instance}`, {
    headers: { "token": token },
  }).then(r => r.json()).catch(() => ({}))

  const qr = qrRes?.qrcode ?? qrRes?.base64 ?? null
  return { qr, status: "awaiting_scan" }
}
