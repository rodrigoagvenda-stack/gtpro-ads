import crypto from "crypto"
import { createServiceClient } from "./supabase"
import { decrypt } from "./crypto"

const GRAPH = "https://graph.facebook.com/v22.0"

function sha256(value: string): string {
  return crypto.createHash("sha256").update(value.toLowerCase().trim()).digest("hex")
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.length === 10 || digits.length === 11) return `55${digits}`
  return digits
}

export type CAPIEventName = "Lead" | "Purchase" | "CompleteRegistration"

export interface CAPIPayload {
  eventName: CAPIEventName
  eventId?: string
  eventTime?: number
  email?: string | null
  phone?: string | null
  firstName?: string | null
  eventSourceUrl?: string | null
  fbclid?: string | null
  value?: number | null
  currency?: string
}

async function getPixelAndToken(tenantId: string) {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from("meta_connections")
    .select("pixel_id, access_token_encrypted")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .single()
  if (!data?.pixel_id || !data.access_token_encrypted) return null
  return { pixelId: data.pixel_id, token: decrypt(data.access_token_encrypted) }
}

export async function sendCAPIEvent(tenantId: string, event: CAPIPayload): Promise<boolean> {
  try {
    const conn = await getPixelAndToken(tenantId)
    if (!conn) return false

    const userData: Record<string, string> = {}
    if (event.email)     userData.em = sha256(event.email)
    if (event.phone)     userData.ph = sha256(normalizePhone(event.phone))
    if (event.firstName) userData.fn = sha256(event.firstName.toLowerCase().trim())
    if (event.fbclid)    userData.fbc = `fb.1.${Math.floor(Date.now() / 1000)}.${event.fbclid}`

    const eventData: Record<string, unknown> = {
      event_name:    event.eventName,
      event_time:    event.eventTime ?? Math.floor(Date.now() / 1000),
      action_source: "website",
      user_data:     userData,
    }
    if (event.eventSourceUrl) eventData.event_source_url = event.eventSourceUrl
    if (event.eventId)        eventData.event_id = event.eventId
    if (event.eventName === "Purchase" && event.value != null) {
      eventData.custom_data = { currency: event.currency ?? "BRL", value: event.value }
    }

    const url = new URL(`${GRAPH}/${conn.pixelId}/events`)
    url.searchParams.set("access_token", conn.token)

    const res = await fetch(url.toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: [eventData] }),
    })

    return res.ok
  } catch {
    return false
  }
}
