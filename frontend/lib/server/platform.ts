import { createServiceClient } from "./supabase"
import { decrypt, encrypt } from "./crypto"

const cache = new Map<string, { value: string; ts: number }>()
const TTL = 300_000

// Rows written before encryption was wired up here are stored as raw plaintext
// (no iv:tag:ciphertext structure). Decrypt when possible, fall back otherwise
// so already-configured settings don't break while they get re-saved.
function safeDecrypt(raw: string): string {
  if (!raw) return raw
  if (raw.startsWith("plain:")) return decrypt(raw)
  const parts = raw.split(":")
  if (parts.length === 3 && parts.every(p => /^[0-9a-f]+$/i.test(p))) {
    try { return decrypt(raw) } catch { /* fall through to legacy plaintext */ }
  }
  return raw
}

async function getSetting(key: string): Promise<string> {
  const cached = cache.get(key)
  if (cached && Date.now() - cached.ts < TTL) return cached.value

  const supabase = createServiceClient()
  const { data } = await supabase
    .from("platform_settings")
    .select("value_encrypted")
    .eq("key", key)
    .single()

  const value = safeDecrypt(data?.value_encrypted ?? "")
  cache.set(key, { value, ts: Date.now() })
  return value
}

export async function setSetting(key: string, value: string) {
  const supabase = createServiceClient()
  const { error } = await supabase
    .from("platform_settings")
    .update({ value_encrypted: encrypt(value), updated_at: new Date().toISOString() })
    .eq("key", key)
  if (error) throw new Error(error.message)
  cache.delete(key)
}

export const getAnthropicKey        = () => getSetting("anthropic_api_key")
export const getMetaAppId           = () => getSetting("meta_app_id")
export const getMetaAppSecret       = () => getSetting("meta_app_secret")
export const getGoogleClientId      = () => getSetting("google_client_id")
export const getGoogleClientSecret  = () => getSetting("google_client_secret")
export const getGoogleDeveloperToken = () => getSetting("google_developer_token")
export { getSetting }
