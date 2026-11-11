import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';
import { revokeRequestSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

// Logging out revokes the token server-side (see lib/session.ts), so the
// old token cannot be reused afterwards — it is not just cleared from
// the browser.
export async function POST(request: NextRequest) {
  await revokeRequestSession(request);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
