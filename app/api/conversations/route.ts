import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getConversations } from '@/lib/db';
import type { Conversation, InboxType, Platform } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const allConversations = await getConversations();
  const params = request.nextUrl.searchParams;
  const type = params.get('type');
  const platform = params.get('platform');
  const accountId = params.get('accountId');
  const query = params.get('q')?.trim().toLowerCase();

  let conversations = [...allConversations];
  if (type === 'dm' || type === 'comment') {
    conversations = conversations.filter((conversation) => conversation.type === (type as InboxType));
  }
  if (platform && platform !== 'all') {
    conversations = conversations.filter(
      (conversation) => conversation.platform === (platform as Platform),
    );
  }
  if (accountId && accountId !== 'all') {
    conversations = conversations.filter((conversation) => conversation.accountId === accountId);
  }
  if (query) {
    conversations = conversations.filter((conversation) =>
      `${conversation.participant.name} ${conversation.participant.handle} ${conversation.preview} ${conversation.subject ?? ''}`
        .toLowerCase()
        .includes(query),
    );
  }

  conversations.sort((a, b) => {
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    return b.lastMessageAt.localeCompare(a.lastMessageAt);
  });

  return NextResponse.json({
    conversations,
    counts: {
      all: allConversations.length,
      unread: allConversations.filter((conversation) => conversation.unread).length,
      dm: allConversations.filter((conversation: Conversation) => conversation.type === 'dm').length,
      comment: allConversations.filter((conversation: Conversation) => conversation.type === 'comment')
        .length,
    },
  });
}
