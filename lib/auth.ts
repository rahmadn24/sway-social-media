// Sway sign-in. Accounts live in Postgres (see prisma/seed.ts):
//   - demo user (role 'demo'): random password hash nobody knows; the only
//     way in as demo is POST /api/auth/demo, which looks the user up by
//     role='demo' — never by a hardcoded email, and the login page shows no
//     password anywhere.
//   - admin user (role 'admin'): created from SWAY_ADMIN_EMAIL /
//     SWAY_ADMIN_PASSWORD at seed time, scrypt-hashed in the users table.
//
// Sessions are HMAC-SHA256 signed tokens in an httpOnly cookie. Everything
// here uses Web Crypto only, so the same code runs in Node route handlers
// and in the Edge middleware. Passwords are never handled here — see
// lib/credentials.ts (Node-only, scrypt + Prisma).
//
// There is no SQL string building anywhere in Sway: every database access
// goes through Prisma's parameterized client, so injection strings have
// nothing to land on.

export const SESSION_COOKIE = 'sway-session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;
const SESSION_TTL_MS = SESSION_MAX_AGE_SECONDS * 1000;

export type SessionRole = 'demo' | 'admin';

export interface SessionUser {
  id: string;
  email: string;
  role: SessionRole;
  exp: number;
}

let warnedAboutDevSecret = false;
let devSecret: string | null = null;

/**
 * The secret that signs session cookies.
 *
 * Production: SWAY_SESSION_SECRET is required — the server refuses to start
 * without it (see instrumentation.ts) and this throws as a backstop.
 *
 * Development: derived from DATABASE_URL with SHA-256, so the Node server
 * and the Edge middleware (separate isolates, no shared module state) agree
 * on the same secret. It is not a constant in the code and cannot be
 * guessed without the database URL. Without DATABASE_URL it falls back to
 * a random per-boot value (dev auth across runtimes may break then, but the
 * app needs a database to do anything at all).
 */
export async function getSessionSecret(): Promise<string> {
  const secret = process.env.SWAY_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      '[sway] SWAY_SESSION_SECRET is not set. Generate one with: openssl rand -hex 32',
    );
  }
  if (!devSecret) {
    const seed = process.env.DATABASE_URL ?? crypto.randomUUID();
    devSecret = await sha256Hex(`sway-dev-session:${seed}`);
    if (!warnedAboutDevSecret) {
      warnedAboutDevSecret = true;
      console.warn(
        '[sway] SWAY_SESSION_SECRET is not set; using a dev secret derived from DATABASE_URL. ' +
          'Set a real secret on the VPS (see .env.example).',
      );
    }
  }
  return devSecret;
}

// ---------- primitives (Web Crypto, works in Node and Edge) ----------

const B64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_REVERSE: Record<string, number> = {};
for (let i = 0; i < B64_ALPHABET.length; i++) B64_REVERSE[B64_ALPHABET[i]] = i;

export function base64urlEncode(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64_ALPHABET[b0 >> 2];
    out += B64_ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)];
    if (i + 1 < bytes.length) out += B64_ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)];
    if (i + 2 < bytes.length) out += B64_ALPHABET[b2 & 0x3f];
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_');
}

export function base64urlDecode(input: string): Uint8Array | null {
  const clean = input.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  if (clean.length % 4 === 1) return null;
  const out: number[] = [];
  for (let i = 0; i < clean.length; i += 4) {
    const c0 = B64_REVERSE[clean[i]];
    const c1 = B64_REVERSE[clean[i + 1]];
    if (c0 === undefined || c1 === undefined) return null;
    out.push((c0 << 2) | (c1 >> 4));
    if (i + 2 < clean.length) {
      const c2 = B64_REVERSE[clean[i + 2]];
      if (c2 === undefined) return null;
      out.push(((c1 & 0x0f) << 4) | (c2 >> 2));
      if (i + 3 < clean.length) {
        const c3 = B64_REVERSE[clean[i + 3]];
        if (c3 === undefined) return null;
        out.push(((c2 & 0x03) << 6) | c3);
      }
    }
  }
  return new Uint8Array(out);
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return new Uint8Array(signature);
}

/** Constant-time string comparison (lengths are fixed for hashes/signatures). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------- sessions ----------

export async function createSessionToken(user: {
  id: string;
  email: string;
  role: SessionRole;
}): Promise<string> {
  const payload: SessionUser = {
    id: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + SESSION_TTL_MS,
  };
  const payloadB64 = base64urlEncode(new TextEncoder().encode(JSON.stringify(payload)));
  const signature = base64urlEncode(await hmacSha256(await getSessionSecret(), payloadB64));
  return `${payloadB64}.${signature}`;
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  const [payloadB64, signatureB64] = token.split('.');
  if (!payloadB64 || !signatureB64 || token.split('.').length !== 2) return null;
  const expected = base64urlEncode(await hmacSha256(await getSessionSecret(), payloadB64));
  if (!timingSafeEqual(expected, signatureB64)) return null;
  const payloadBytes = base64urlDecode(payloadB64);
  if (!payloadBytes) return null;
  let payload: SessionUser;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionUser;
  } catch {
    return null;
  }
  if (typeof payload.id !== 'string' || !payload.id) return null;
  if (typeof payload.email !== 'string') return null;
  if (payload.role !== 'demo' && payload.role !== 'admin') return null;
  if (typeof payload.exp !== 'number' || payload.exp <= Date.now()) return null;
  return payload;
}

/** Resolve the signed-in user from a request's session cookie (Node route
 *  handlers). Returns null when there is no valid session. */
export async function getSessionUser(request: Request): Promise<SessionUser | null> {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  if (!token) return null;
  return verifySessionToken(token);
}

// ---------- login rate limit (in-memory, per IP, 10 failures / 10 min) ----------

const LOGIN_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_MAX_FAILURES = 10;

const loginFailures = new Map<string, { count: number; resetAt: number }>();

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return 'unknown';
}

export function loginRateLimited(ip: string): boolean {
  const entry = loginFailures.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginFailures.delete(ip);
    return false;
  }
  return entry.count >= LOGIN_MAX_FAILURES;
}

export function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = loginFailures.get(ip);
  if (!entry || now > entry.resetAt) {
    loginFailures.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return;
  }
  entry.count += 1;
}

export function clearLoginFailures(ip: string): void {
  loginFailures.delete(ip);
}
