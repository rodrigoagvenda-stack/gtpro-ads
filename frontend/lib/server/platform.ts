import { createServiceClient } from "./supabase"

function safeEncrypt(value: string): string {
  if (!process.env.ENCRYPTION_KEY) return value
  const { encrypt } = require("./crypto")
  return encrypt(value)
}

function safeDecrypt(value: string): string {
  if (!process.env.ENCRYPTION_KEY || !value.includes(":")) return value
  const { decrypt } = require("./crypto")
  try { return decrypt(value) } catch { return value }
}

const cache = new Map<string, { value: string; ts: number }>()
const TTL = 300_000

async function getSetting(key: string): Promise<string> {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < TTL) return cached.value

  const supabase = createServiceClient()
  const { data } = await supabase
    .from("platform_settings")
    .select("value_encrypted")
    .eq("key", key)
    .single()

  const raw = data?.value_encrypted ?? ""
  const value = raw ? safeDecrypt(raw) : ""
  cache.set(key, { value, ts: Date.now() })
  return value
}

export async function setSetting(key: string, value: string) {
  const supabase = createServiceClient()
  await supabase.from("platform_settings").upsert(
    { key, value_encrypted: value ? safeEncrypt(value) : "", updated_at: new Date().toISOString() },
    { onConflict: "key" }
  )
  cache.delete(key)
}

export const getAnthropicKey = () => getSetting("anthropic_api_key")
export const getMetaAppId = () => getSetting("meta_app_id")
export const getMetaAppSecret = () => getSetting("meta_app_secret")
export { getSetting }
