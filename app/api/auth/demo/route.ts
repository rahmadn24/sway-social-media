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
import { findDemoUser } from '@/lib/credentials';

export const dynamic = 'force-dynamic';

// Demo entry: no password is ever shown or typed. The demo account is
// looked up by role='demo' (its stored password is a random hash nobody
// knows) and a session is created for it. Rate-limited like sign-in so the
// endpoint cannot be hammered.
export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  if (loginRateLimited(ip)) {
    return NextResponse.json(
      { ok: false, error: 'Too many sign-in attempts. Try again in a few minutes.' },
      { status: 429 },
    );
  }

  const user = await findDemoUser();
  if (!user) {
    recordLoginFailure(ip);
    return NextResponse.json(
      { ok: false, error: 'Demo account is not available right now.' },
      { status: 503 },
    );
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
