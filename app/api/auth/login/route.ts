import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  clearLoginFailures,
  createSessionToken,
  getClientIp,
  loginRateLimited,
  recordLoginFailure,
} from '@/lib/auth';
import { verifyCredentials } from '@/lib/credentials';

export const dynamic = 'force-dynamic';

const GENERIC_ERROR = 'Invalid email or password.';

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (loginRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Too many failed sign-in attempts. Try again in a few minutes.' },
      { status: 429 },
    );
  }

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const email = (body as { email?: unknown } | null)?.email;
  const password = (body as { password?: unknown } | null)?.password;

  // Non-string values (objects, arrays, numbers) and missing/empty fields all
  // fail the same way as a wrong password: one generic 401, never a hint
  // about which part was wrong.
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    recordLoginFailure(ip);
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
  }

  const user = await verifyCredentials(email, password);
  if (!user) {
    recordLoginFailure(ip);
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
  }

  clearLoginFailures(ip);
  const token = await createSessionToken(user);
  const response = NextResponse.json({
    ok: true,
    user: { email: user.email, role: user.role },
  });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
