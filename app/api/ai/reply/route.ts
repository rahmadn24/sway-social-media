import { NextRequest, NextResponse } from 'next/server';
import { AiRequestError, suggestReply } from '@/lib/ai';
import { getAuthenticatedUser } from '@/lib/session';
import { getConversationById } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  let body: { conversationId?: string };
  try {
    body = (await request.json()) as { conversationId?: string };
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }

  if (!body.conversationId) {
    return NextResponse.json({ error: 'Choose a conversation first.' }, { status: 400 });
  }
  const conversation = await getConversationById(body.conversationId);
  if (!conversation) {
    return NextResponse.json({ error: 'Conversation not found.' }, { status: 404 });
  }

  try {
    const result = await suggestReply(conversation, user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AiRequestError) {
      return NextResponse.json(
        { error: 'The AI provider couldn’t write a reply.', detail: error.message },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: 'The AI provider couldn’t write a reply.',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 },
    );
  }
}
