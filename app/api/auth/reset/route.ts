import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { resetWorkspaceContent } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Protected: any signed-in user (demo or admin) can reset. The workspace
// content tables are truncated and re-seeded with the demo workspace.
// Users and their AI settings are untouched, so a connected provider key
// survives a reset.
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  await resetWorkspaceContent();
  return NextResponse.json({
    ok: true,
    message: 'Demo workspace reset to fresh demo data.',
  });
}
