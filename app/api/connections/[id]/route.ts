import { NextRequest, NextResponse } from 'next/server';
import { platformsForAccountIds } from '@/lib/accounts';
import { readDb, writeDb } from '@/lib/store';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }

  const db = readDb();
  const account = db.accounts.find((candidate) => candidate.id === id);
  if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  const now = new Date().toISOString();

  switch (body.action) {
    case 'connect':
      account.connected = true;
      account.health = 'healthy';
      account.lastSyncedAt = now;
      break;
    case 'disconnect':
      account.connected = false;
      account.health = 'attention';
      break;
    case 'refresh':
      account.connected = true;
      account.health = 'healthy';
      account.lastSyncedAt = now;
      break;
    case 'primary':
      db.accounts.forEach((candidate) => {
        if (candidate.platform === account.platform) candidate.isPrimary = candidate.id === account.id;
      });
      break;
    default:
      return NextResponse.json({ error: 'Unknown connection action.' }, { status: 400 });
  }

  writeDb(db);
  return NextResponse.json({ account });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const db = readDb();
  const account = db.accounts.find((candidate) => candidate.id === id);
  if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  const siblings = db.accounts.filter(
    (candidate) => candidate.platform === account.platform && candidate.id !== account.id,
  );
  if (siblings.length === 0) {
    return NextResponse.json(
      {
        error: `Connect another ${account.platform} account before removing ${account.displayName}. Disconnect it instead to pause publishing.`,
      },
      { status: 409 },
    );
  }

  const replacement = siblings.find((candidate) => candidate.isPrimary) ?? siblings[0];

  db.posts.forEach((post) => {
    if (!post.accountIds.includes(account.id)) return;
    post.accountIds = [
      ...new Set(post.accountIds.map((accountId) => (accountId === account.id ? replacement.id : accountId))),
    ];
    post.platforms = platformsForAccountIds(db.accounts, post.accountIds);
    post.updatedAt = new Date().toISOString();
  });

  db.conversations.forEach((conversation) => {
    if (conversation.accountId === account.id) conversation.accountId = replacement.id;
  });

  db.notifications.forEach((notification) => {
    if (notification.accountId === account.id) notification.accountId = replacement.id;
  });

  if (account.isPrimary && !replacement.isPrimary) replacement.isPrimary = true;

  db.accounts = db.accounts.filter((candidate) => candidate.id !== account.id);
  writeDb(db);
  return NextResponse.json({ ok: true, reassignedTo: replacement.id });
}
