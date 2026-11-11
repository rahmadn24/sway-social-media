import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { buildOverview, parseRange } from '@/lib/overview';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const range = parseRange(request.nextUrl.searchParams.get('range'));
  return NextResponse.json(await buildOverview(range));
}
