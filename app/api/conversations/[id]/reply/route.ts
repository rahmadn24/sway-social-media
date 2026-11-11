import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { serializeConversation } from '@/lib/db';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.conversation.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });

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

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    await tx.conversationMessage.create({
      data: {
        id: crypto.randomUUID(),
        conversationId: id,
        from: 'me',
        text,
        createdAt: now,
      },
    });
    return tx.conversation.update({
      where: { id },
      data: {
        preview: text,
        lastMessageAt: now,
        unread: false,
        status: 'replied',
      },
      include: { messages: true },
    });
  });
  return NextResponse.json({ conversation: serializeConversation(updated) });
}
