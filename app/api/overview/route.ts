import { NextRequest, NextResponse } from 'next/server';
import { buildOverview, parseRange } from '@/lib/overview';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const range = parseRange(request.nextUrl.searchParams.get('range'));
  return NextResponse.json(buildOverview(range));
}
