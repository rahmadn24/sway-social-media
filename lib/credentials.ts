import { prisma } from './prisma';
import { verifyPassword } from './passwords';
import type { SessionRole } from './auth';

// Credential checks against the Postgres users table. Node-only (scrypt +
// Prisma); the Edge middleware never imports this module.
//
// The input password is always verified against a hash — even for unknown
// emails, a dummy scrypt verification runs first so a wrong email and a
// wrong password take the same path and return the same result.

const DUMMY_HASH =
  'scrypt$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000';

export async function verifyCredentials(
  email: string,
  password: string,
): Promise<{ id: string; email: string; role: SessionRole } | null> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) {
    // Same cost as a real check; reveals nothing about which emails exist.
    await verifyPassword(password, DUMMY_HASH);
    return null;
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return { id: user.id, email: user.email, role: user.role as SessionRole };
}

/** The demo account, looked up by role — never by a hardcoded email. */
export async function findDemoUser(): Promise<{
  id: string;
  email: string;
  role: SessionRole;
} | null> {
  const user = await prisma.user.findFirst({
    where: { role: 'demo' },
    orderBy: { createdAt: 'asc' },
  });
  if (!user) return null;
  return { id: user.id, email: user.email, role: user.role as SessionRole };
}
