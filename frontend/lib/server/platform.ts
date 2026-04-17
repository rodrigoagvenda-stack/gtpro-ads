import { createServiceClient } from "./supabase"

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

  const value = data?.value_encrypted ?? ""
  cache.set(key, { value, ts: Date.now() })
  return value
}

export async function setSetting(key: string, value: string) {
  const supabase = createServiceClient()
  const { error } = await supabase.from("platform_settings").upsert(
    { key, value_encrypted: value, updated_at: new Date().toISOString() },
    { onConflict: "key" }
  )
  if (error) throw new Error(error.message)
  cache.delete(key)
}

export const getAnthropicKey = () => getSetting("anthropic_api_key")
export const getMetaAppId = () => getSetting("meta_app_id")
export const getMetaAppSecret = () => getSetting("meta_app_secret")
export { getSetting }
