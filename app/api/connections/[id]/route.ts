import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { platformsForAccountIds } from '@/lib/accounts';
import { getAccounts, serializeAccount } from '@/lib/db';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const { id } = await context.params;
  let body: { action?: string };
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }

  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  const now = new Date();

  switch (body.action) {
    case 'connect':
      await prisma.account.update({
        where: { id },
        data: { connected: true, health: 'healthy', lastSyncedAt: now },
      });
      break;
    case 'disconnect':
      await prisma.account.update({
        where: { id },
        data: { connected: false, health: 'attention' },
      });
      break;
    case 'refresh':
      await prisma.account.update({
        where: { id },
        data: { connected: true, health: 'healthy', lastSyncedAt: now },
      });
      break;
    case 'primary':
      await prisma.$transaction([
        prisma.account.updateMany({
          where: { platform: account.platform },
          data: { isPrimary: false },
        }),
        prisma.account.update({ where: { id }, data: { isPrimary: true } }),
      ]);
      break;
    default:
      return NextResponse.json({ error: 'Unknown connection action.' }, { status: 400 });
  }

  const updated = await prisma.account.findUniqueOrThrow({ where: { id } });
  return NextResponse.json({ account: serializeAccount(updated) });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const { id } = await context.params;
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  const siblings = await prisma.account.findMany({
    where: { platform: account.platform, id: { not: id } },
    orderBy: { sortOrder: 'asc' },
  });
  if (siblings.length === 0) {
    return NextResponse.json(
      {
        error: `Connect another ${account.platform} account before removing ${account.displayName}. Disconnect it instead to pause publishing.`,
      },
      { status: 409 },
    );
  }

  const replacement = siblings.find((candidate) => candidate.isPrimary) ?? siblings[0];
  const accounts = await getAccounts();
  const remaining = accounts.filter((candidate) => candidate.id !== id);

  await prisma.$transaction(async (tx) => {
    // Posts: drop the deleted link, then link the replacement (unless the
    // post already uses it). Platforms are recomputed from the links.
    const links = await tx.postAccount.findMany({ where: { accountId: id } });
    for (const link of links) {
      await tx.postAccount.delete({
        where: { postId_accountId: { postId: link.postId, accountId: id } },
      });
      const alreadyLinked = await tx.postAccount.findUnique({
        where: {
          postId_accountId: { postId: link.postId, accountId: replacement.id },
        },
      });
      if (!alreadyLinked) {
        await tx.postAccount.create({
          data: { postId: link.postId, accountId: replacement.id },
        });
      }
      const linkedIds = (
        await tx.postAccount.findMany({
          where: { postId: link.postId },
          select: { accountId: true },
        })
      ).map((row) => row.accountId);
      await tx.post.update({
        where: { id: link.postId },
        data: {
          platforms: platformsForAccountIds(remaining, linkedIds),
          updatedAt: new Date(),
        },
      });
    }

    await tx.conversation.updateMany({
      where: { accountId: id },
      data: { accountId: replacement.id },
    });
    await tx.appNotification.updateMany({
      where: { accountId: id },
      data: { accountId: replacement.id },
    });

    if (account.isPrimary && !replacement.isPrimary) {
      await tx.account.update({
        where: { id: replacement.id },
        data: { isPrimary: true },
      });
    }
    await tx.account.delete({ where: { id } });
  });

  return NextResponse.json({ ok: true, reassignedTo: replacement.id });
}
