import { NextRequest, NextResponse } from 'next/server';
import { buildAnalytics, parseAnalyticsRange } from '@/lib/analytics';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const range = parseAnalyticsRange(request.nextUrl.searchParams.get('range'));
  return NextResponse.json(buildAnalytics(range));
}
