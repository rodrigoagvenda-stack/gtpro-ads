import { createServiceClient } from "./supabase"
import { encrypt, decrypt } from "./crypto"

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
  const value = raw ? decrypt(raw) : ""
  cache.set(key, { value, ts: Date.now() })
  return value
}

export async function setSetting(key: string, value: string) {
  const supabase = createServiceClient()
  await supabase.from("platform_settings").upsert(
    { key, value_encrypted: value ? encrypt(value) : "", updated_at: new Date().toISOString() },
    { onConflict: "key" }
  )
  cache.delete(key)
}

export const getAnthropicKey = () => getSetting("anthropic_api_key")
export const getMetaAppId = () => getSetting("meta_app_id")
export const getMetaAppSecret = () => getSetting("meta_app_secret")
export { getSetting }
