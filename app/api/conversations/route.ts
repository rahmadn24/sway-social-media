import { NextRequest, NextResponse } from 'next/server';
import { readDb } from '@/lib/store';
import type { Conversation, InboxType, Platform } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const db = readDb();
  const params = request.nextUrl.searchParams;
  const type = params.get('type');
  const platform = params.get('platform');
  const accountId = params.get('accountId');
  const query = params.get('q')?.trim().toLowerCase();

  let conversations = [...db.conversations];
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
      all: db.conversations.length,
      unread: db.conversations.filter((conversation) => conversation.unread).length,
      dm: db.conversations.filter((conversation: Conversation) => conversation.type === 'dm').length,
      comment: db.conversations.filter((conversation: Conversation) => conversation.type === 'comment')
        .length,
    },
  });
}
