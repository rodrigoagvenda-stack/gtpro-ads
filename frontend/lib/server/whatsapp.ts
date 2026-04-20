import { createServiceClient } from "./supabase"

async function getPlatformSetting(key: string): Promise<string> {
  const supabase = createServiceClient()
  const { data } = await supabase.from("platform_settings").select("value_encrypted").eq("key", key).single()
  return data?.value_encrypted ?? ""
}

export async function sendWhatsApp(to: string, message: string): Promise<boolean> {
  const provider = await getPlatformSetting("whatsapp_provider")
  if (!provider || !to) return false

  const phone = to.replace(/\D/g, "")

  if (provider === "uazapi") {
    const baseUrl  = await getPlatformSetting("whatsapp_uazapi_url")
    const apiKey   = await getPlatformSetting("whatsapp_uazapi_key")
    const instance = await getPlatformSetting("whatsapp_uazapi_instance")
    if (!baseUrl || !apiKey || !instance) return false

    const res = await fetch(`${baseUrl}/message/sendText/${instance}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ number: `${phone}@s.whatsapp.net`, text: message }),
    })
    return res.ok
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

export async function getUazapiQR(): Promise<{ qr: string | null; status: string }> {
  const baseUrl  = await getPlatformSetting("whatsapp_uazapi_url")
  const apiKey   = await getPlatformSetting("whatsapp_uazapi_key")
  const instance = await getPlatformSetting("whatsapp_uazapi_instance")
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
