import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY!
  return Buffer.from(raw, "base64").subarray(0, 32)
}

export function encrypt(text: string): string {
  const iv = randomBytes(16)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`
}

export function decrypt(data: string): string {
  const [ivHex, tagHex, encHex] = data.split(":")
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  return decipher.update(Buffer.from(encHex, "hex")) + decipher.final("utf8")
}

export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex")
}
