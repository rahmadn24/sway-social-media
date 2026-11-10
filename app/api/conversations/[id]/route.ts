import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/store';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const conversation = readDb().conversations.find((candidate) => candidate.id === id);
  if (!conversation) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  return NextResponse.json({ conversation });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const db = readDb();
  const conversation = db.conversations.find((candidate) => candidate.id === id);
  if (!conversation) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }

  if (typeof body.unread === 'boolean') conversation.unread = body.unread;
  if (typeof body.starred === 'boolean') conversation.starred = body.starred;
  if (body.status === 'open' || body.status === 'replied' || body.status === 'resolved') {
    conversation.status = body.status;
  }
  writeDb(db);
  return NextResponse.json({ conversation });
}
