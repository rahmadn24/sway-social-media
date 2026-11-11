import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getConversationById, serializeConversation } from '@/lib/db';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const { id } = await context.params;
  const conversation = await getConversationById(id);
  if (!conversation) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  return NextResponse.json({ conversation });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.conversation.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }

  const data: { unread?: boolean; starred?: boolean; status?: string } = {};
  if (typeof body.unread === 'boolean') data.unread = body.unread;
  if (typeof body.starred === 'boolean') data.starred = body.starred;
  if (body.status === 'open' || body.status === 'replied' || body.status === 'resolved') {
    data.status = body.status;
  }
  const updated = await prisma.conversation.update({
    where: { id },
    data,
    include: { messages: true },
  });
  return NextResponse.json({ conversation: serializeConversation(updated) });
}
