import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';

// Password hashing for Sway accounts. Node-only (scrypt); the Edge
// middleware never touches passwords, it only verifies session tokens
// (see lib/auth.ts), so this module must never be imported from middleware.
//
// Format: `scrypt$<salt hex>$<derived key hex>`
// Params: N=16384, r=8, p=1, 64-byte key. A fresh random salt per password.

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// Small Promise wrapper around the callback API (promisify() picks the
// wrong scrypt overload in @types/node and rejects the options argument).
function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(
      password,
      salt,
      KEY_LENGTH,
      { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P },
      (err, derived) => {
        if (err) reject(err);
        else resolve(derived as Buffer);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scryptAsync(password, salt);
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Constant-time verification. Unknown/malformed hashes simply fail. */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, saltHex, keyHex] = parts;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(saltHex, 'hex');
    expected = Buffer.from(keyHex, 'hex');
  } catch {
    return false;
  }
  if (salt.length !== SALT_LENGTH || expected.length !== KEY_LENGTH) return false;
  const derived = await scryptAsync(password, salt);
  return timingSafeEqual(derived, expected);
}

/** A random password nobody knows — used for the demo account, which can
 *  only be entered through POST /api/auth/demo, never by typing a password. */
export function randomPassword(): string {
  return randomBytes(32).toString('hex');
}
