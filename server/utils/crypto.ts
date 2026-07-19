const ALGORITHM = "AES-CBC";
const IV_LENGTH = 16;
const HASH_ALGORITHM = "SHA-256";

async function getSecret(): Promise<CryptoKey> {
  const secret = process.env.ROUTER_PASSWORD_SECRET;
  if (!secret) {
    throw new Error("Missing ROUTER_PASSWORD_SECRET environment variable");
  }

  // Hash da secret com SHA-256
  const secretBuffer = new TextEncoder().encode(secret);
  const hashBuffer = await crypto.subtle.digest(HASH_ALGORITHM, secretBuffer);

  // Importa a chave para uso com AES-CBC
  const key = await crypto.subtle.importKey(
    "raw",
    hashBuffer,
    ALGORITHM,
    false,
    ["encrypt", "decrypt"],
  );

  return key;
}

function unit8ArrayToHex(array: Uint8Array<ArrayBuffer>) {
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
  return unit8ArrayToHex(new Uint8Array(buffer));
}

function hexToArrayBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes.buffer;
}

export async function encryptPassword(password: string): Promise<string> {
  const key = await getSecret();

  // Gera IV aleatório
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Encripta a senha
  const passwordBuffer = new TextEncoder().encode(password);
  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    passwordBuffer,
  );

  // Retorna IV:encrypted em formato hex
  const ivHex = unit8ArrayToHex(iv);
  const encryptedHex = arrayBufferToHex(encryptedBuffer);

  return `${ivHex}:${encryptedHex}`;
}

export async function decryptPassword(
  encryptedPassword: string,
): Promise<string> {
  const key = await getSecret();

  const [ivHex, encryptedHex] = encryptedPassword.split(":");
  const iv = new Uint8Array(hexToArrayBuffer(ivHex));
  const encryptedBuffer = hexToArrayBuffer(encryptedHex);

  // Decripta
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: ALGORITHM,
      iv: iv,
    },
    key,
    encryptedBuffer,
  );

  return new TextDecoder().decode(decryptedBuffer);
}
