import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function getSecret(): Buffer {
  const secret = process.env.ROUTER_PASSWORD_SECRET;
  if (!secret) {
    throw new Error("Missing ROUTER_PASSWORD_SECRET environment variable");
  }
  const hash = createHash("sha256").update(secret).digest();
  return hash;
}

import { createHash } from "crypto";

export function encryptPassword(password: string): string {
  const key = getSecret();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(password, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

export function decryptPassword(encryptedPassword: string): string {
  const key = getSecret();
  const [ivHex, encrypted] = encryptedPassword.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
