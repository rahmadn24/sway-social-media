import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

// AES-256-GCM encryption for per-user AI provider API keys stored in
// Postgres. Node-only; the key itself never leaves the server and is never
// returned by any API response.
//
// Key: SWAY_ENCRYPTION_KEY, 64 hex chars (32 bytes). Generate with:
//   openssl rand -hex 32
// Production fails hard when it is unset. In development a random per-boot
// key is generated (keys saved in one dev boot cannot be decrypted in the
// next — expected; dev data is disposable).

// Format: `v1$<iv hex>$<auth tag hex>$<ciphertext hex>`

let warnedAboutDevKey = false;
let devKey: Buffer | null = null;

export function getEncryptionKey(): Buffer {
  const raw = process.env.SWAY_ENCRYPTION_KEY?.trim();
  if (raw) {
    const key = Buffer.from(raw, 'hex');
    if (key.length !== 32) {
      throw new Error(
        '[sway] SWAY_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate one with: openssl rand -hex 32',
      );
    }
    return key;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[sway] SWAY_ENCRYPTION_KEY is not set. API keys cannot be stored safely without it. Set it in .env (see .env.example).',
    );
  }
  if (!devKey) {
    devKey = randomBytes(32);
    if (!warnedAboutDevKey) {
      warnedAboutDevKey = true;
      console.warn(
        '[sway] SWAY_ENCRYPTION_KEY is not set; using a random per-boot dev key. ' +
          'Saved provider keys will not survive a restart.',
      );
    }
  }
  return devKey;
}

export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1$${iv.toString('hex')}$${tag.toString('hex')}$${ciphertext.toString('hex')}`;
}

/** Returns null when the value is missing or undecryptable (wrong key or
 *  tampered data) instead of throwing — callers treat that as "no key". */
export function decryptApiKey(stored: string | null | undefined): string | null {
  if (!stored) return null;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  const [, ivHex, tagHex, cipherHex] = parts;
  let key: Buffer;
  try {
    key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(cipherHex, 'hex');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}
