import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export function encryptSecret(value: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", normalizeKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSecret(value: string, key: string) {
  const [version, ivRaw, authTagRaw, ciphertextRaw] = value.split(".");
  if (version !== "v1" || !ivRaw || !authTagRaw || !ciphertextRaw) {
    throw new Error("Unsupported encrypted secret format");
  }

  const decipher = createDecipheriv("aes-256-gcm", normalizeKey(key), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(authTagRaw, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

function normalizeKey(key: string) {
  return createHash("sha256").update(key).digest();
}
