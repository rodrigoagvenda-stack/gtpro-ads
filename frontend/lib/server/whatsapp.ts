import { createServiceClient } from "./supabase"

async function getPlatformSetting(key: string): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase.from("platform_settings").select("value_encrypted").eq("key", key).single()
  return data?.value_encrypted ?? ""
}

async function getUazapiConfig() {
  const [baseUrl, apiKey, instance] = await Promise.all([
    getPlatformSetting("whatsapp_uazapi_url"),
    getPlatformSetting("whatsapp_uazapi_key"),
    getPlatformSetting("whatsapp_uazapi_instance"),
  ])
  return { baseUrl, apiKey, instance }
}

function uazHeaders(apiKey: string) {
  return { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` }
}

// ─── Public send helpers (UazAPI only) ───────────────────────────────────────

export async function sendText(to: string, text: string): Promise<boolean> {
  const { baseUrl, apiKey, instance } = await getUazapiConfig()
  if (!baseUrl || !apiKey || !instance) return false
  const number = to.includes("@") ? to : `${to}@s.whatsapp.net`
  const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
    method: "POST",
    headers: uazHeaders(apiKey),
    body: JSON.stringify({ number, text }),
  })
  if (!res.ok) console.error("[sendText] error:", await res.text().catch(() => ""))
  return res.ok
}

export async function sendButtons(
  to: string,
  body: string,
  buttons: { id: string; label: string }[]
): Promise<boolean> {
  const { baseUrl, apiKey, instance } = await getUazapiConfig()
  if (!baseUrl || !apiKey || !instance) return false
  const number = to.includes("@") ? to : `${to}@s.whatsapp.net`

  const res = await fetch(`${baseUrl}/message/sendButtons/${instance}`, {
    method: "POST",
    headers: uazHeaders(apiKey),
    body: JSON.stringify({
      number,
      title: "GTPRO",
      description: body,
      footer: "",
      buttons: buttons.map(b => ({
        buttonId: b.id,
        buttonText: { displayText: b.label },
        type: 1,
      })),
    }),
  })

  if (res.ok) return true

  // Fallback: envia texto com opções numeradas
  const errText = await res.text().catch(() => "")
  console.error("[sendButtons] failed, fallback to text. error:", errText)
  const lines = buttons.map((b, i) => `${i + 1}. ${b.label}`).join("\n")
  return sendText(to, `${body}\n\n${lines}`)
}

export async function sendList(
  to: string,
  body: string,
  buttonText: string,
  rows: { id: string; title: string; subtitle?: string }[]
): Promise<boolean> {
  const { baseUrl, apiKey, instance } = await getUazapiConfig()
  if (!baseUrl || !apiKey || !instance) return false
  const number = to.includes("@") ? to : `${to}@s.whatsapp.net`

  const res = await fetch(`${baseUrl}/message/sendList/${instance}`, {
    method: "POST",
    headers: uazHeaders(apiKey),
    body: JSON.stringify({
      number,
      title: "GTPRO",
      description: body,
      buttonText,
      footer: "",
      sections: [{
        title: "Opções",
        rows: rows.map(r => ({ rowId: r.id, title: r.title, description: r.subtitle ?? "" })),
      }],
    }),
  })

  if (res.ok) return true

  // Fallback: texto numerado
  const errText = await res.text().catch(() => "")
  console.error("[sendList] failed, fallback to text. error:", errText)
  const lines = rows.map((r, i) => `${i + 1}. ${r.title}`).join("\n")
  return sendText(to, `${body}\n\n${lines}`)
}

// ─── Alert dispatch (provider-agnostic) ──────────────────────────────────────

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
  const { baseUrl, apiKey, instance } = await getUazapiConfig()
  if (!baseUrl || !apiKey || !instance) return { qr: null, status: "not_configured" }

  const statusRes = await fetch(`${baseUrl}/instance/connectionState/${instance}`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  }).then(r => r.json()).catch(() => ({}))

  const state = statusRes?.instance?.state ?? statusRes?.state
  if (state === "open") return { qr: null, status: "connected" }

  const qrRes = await fetch(`${baseUrl}/instance/connect/${instance}`, {
    headers: { "Authorization": `Bearer ${apiKey}` },
  }).then(r => r.json()).catch(() => ({}))

  const qr = qrRes?.qrcode ?? qrRes?.base64 ?? null
  return { qr, status: "awaiting_scan" }
}
