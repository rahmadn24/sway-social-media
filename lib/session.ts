// Node-only session enforcement (Prisma + node:crypto). The Edge middleware
// (middleware.ts) can only do the stateless HMAC check, so it redirects
// browsers without a valid token — but every data API goes through
// getAuthenticatedUser() here, which ALSO checks the server-side
// revocation list. Logging out therefore actually invalidates a token:
// a copied or stolen token cannot read or change any data afterwards
// (page shells may still render, but every data call returns 401).
import { createHash } from 'node:crypto';
import { prisma } from './prisma';
import { SESSION_COOKIE, getSessionUser, verifySessionToken, type SessionUser } from './auth';

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function isSessionRevoked(token: string): Promise<boolean> {
  const row = await prisma.revokedSession.findUnique({
    where: { tokenHash: tokenHash(token) },
  });
  return !!row;
}

/** Record a token as revoked until its expiry; prunes expired rows first. */
export async function revokeSessionToken(token: string, expiresAt: Date): Promise<void> {
  await prisma.revokedSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const hash = tokenHash(token);
  await prisma.revokedSession.upsert({
    where: { tokenHash: hash },
    create: { tokenHash: hash, expiresAt },
    update: { expiresAt },
  });
}

function readToken(request: Request): string | null {
  const cookie = request.headers.get('cookie') ?? '';
  const match = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const token = decodeURIComponent(match.slice(SESSION_COOKIE.length + 1));
  return token || null;
}

/** The authoritative session check for API routes: valid signature, not
 *  expired, and not revoked by a logout. Returns null otherwise. */
export async function getAuthenticatedUser(request: Request): Promise<SessionUser | null> {
  const user = await getSessionUser(request);
  if (!user) return null;
  const token = readToken(request);
  if (!token) return null;
  if (await isSessionRevoked(token)) return null;
  return user;
}

/** Revoke the session presented on this request (used by the logout route). */
export async function revokeRequestSession(request: Request): Promise<void> {
  const token = readToken(request);
  if (!token) return;
  const session = await verifySessionToken(token);
  if (!session) return;
  await revokeSessionToken(token, new Date(session.exp));
}
