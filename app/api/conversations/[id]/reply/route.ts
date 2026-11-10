import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/store';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const db = readDb();
  const conversation = db.conversations.find((candidate) => candidate.id === id);
  if (!conversation) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });

  let body: { text?: string };
  try {
    body = (await request.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }

  const text = body.text?.trim();
  if (!text) return NextResponse.json({ error: 'Write a reply first.' }, { status: 400 });
  if (text.length > 2000) {
    return NextResponse.json({ error: 'Replies must be under 2,000 characters.' }, { status: 400 });
  }

  const now = new Date().toISOString();
  conversation.messages.push({
    id: crypto.randomUUID(),
    from: 'me',
    text,
    createdAt: now,
  });
  conversation.preview = text;
  conversation.lastMessageAt = now;
  conversation.unread = false;
  conversation.status = 'replied';
  writeDb(db);
  return NextResponse.json({ conversation });
}
