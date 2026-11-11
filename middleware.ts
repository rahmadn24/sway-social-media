import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';

// Pages are behind sign-in (stateless token check only — the Edge runtime
// cannot query Postgres). API routes enforce sign-in themselves via
// lib/session.ts, which also checks the server-side revocation list, so a
// logged-out token cannot read or change any data.
export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const user = token ? await verifySessionToken(token) : null;
  if (user) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const loginUrl = new URL('/login', request.url);
  if (pathname !== '/') loginUrl.searchParams.set('next', pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|icon.svg|images|avatars|login|api).*)'],
};
