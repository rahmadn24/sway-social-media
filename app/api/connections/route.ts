import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { getPublishingMode } from '@/lib/publishing';
import { getAccounts, serializeAccount } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import { PLATFORMS } from '@/lib/types';
import type { Platform } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DEFAULT_SCOPES: Record<Platform, string[]> = {
  instagram: ['posts', 'comments', 'messages', 'insights'],
  youtube: ['videos', 'comments', 'analytics'],
  tiktok: ['video.publish', 'comments', 'messages'],
  threads: ['threads', 'replies', 'insights'],
  facebook: ['pages', 'comments', 'messages', 'insights'],
};

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const accounts = await getAccounts();
  return NextResponse.json({
    accounts,
    publishingMode: getPublishingMode(),
  });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  let body: {
    platform?: string;
    handle?: string;
    displayName?: string;
    followers?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }

  if (!PLATFORMS.includes(body.platform as Platform)) {
    return NextResponse.json({ error: 'Choose a supported platform.' }, { status: 400 });
  }
  const platform = body.platform as Platform;
  const handle = body.handle?.trim();
  if (!handle) {
    return NextResponse.json({ error: 'Enter the account handle.' }, { status: 400 });
  }
  const normalizedHandle = handle.startsWith('@') ? handle : `@${handle}`;
  const displayName = body.displayName?.trim() || normalizedHandle.replace(/^@/, '');

  const duplicate = await prisma.account.findFirst({
    where: { platform, handle: { equals: normalizedHandle, mode: 'insensitive' } },
  });
  if (duplicate) {
    return NextResponse.json(
      { error: `${normalizedHandle} is already connected on ${platform}.` },
      { status: 409 },
    );
  }

  const maxSort = await prisma.account.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.account.create({
    data: {
      id: `acct_${platform}_${crypto.randomUUID().slice(0, 6)}`,
      platform,
      connected: true,
      handle: normalizedHandle,
      displayName,
      followers: Math.max(0, Math.round(body.followers ?? 0)),
      followerChange: 0,
      engagementRate: 0,
      reach30d: 0,
      health: 'healthy',
      lastSyncedAt: new Date(),
      scopes: DEFAULT_SCOPES[platform],
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
    },
  });
  return NextResponse.json({ account: serializeAccount(created) }, { status: 201 });
}
