import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import { getEnv } from "./env";

function encryptionKey(): Buffer {
  return createHash("sha256").update(getEnv().appSecret, "utf8").digest();
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashToken(value: string): string {
  return createHmac("sha256", getEnv().appSecret).update(value, "utf8").digest("hex");
}

export function hashForBucket(value: string): string {
  return hashToken(value).slice(0, 40);
}

export function safeCompare(left: string, right: string): boolean {
  const a = createHash("sha256").update(left, "utf8").digest();
  const b = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(a, b);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(payload: string): string {
  try {
    const [version, ivPart, tagPart, ciphertextPart] = payload.split(".");
    if (version !== "v1" || !ivPart || !tagPart || !ciphertextPart) {
      throw new Error("Invalid ciphertext");
    }
    const iv = Buffer.from(ivPart, "base64url");
    const tag = Buffer.from(tagPart, "base64url");
    const ciphertext = Buffer.from(ciphertextPart, "base64url");
    if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid ciphertext lengths");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Unable to decrypt a stored secret. Check APP_SECRET and the channel webhook configuration.");
  }
}
