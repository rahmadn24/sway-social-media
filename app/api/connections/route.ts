import { NextRequest, NextResponse } from 'next/server';
import { getPublishingMode } from '@/lib/publishing';
import { readDb, writeDb } from '@/lib/store';
import { PLATFORMS } from '@/lib/types';
import type { Account, Platform } from '@/lib/types';

export const dynamic = 'force-dynamic';

const DEFAULT_SCOPES: Record<Platform, string[]> = {
  instagram: ['posts', 'comments', 'messages', 'insights'],
  youtube: ['videos', 'comments', 'analytics'],
  tiktok: ['video.publish', 'comments', 'messages'],
  threads: ['threads', 'replies', 'insights'],
  facebook: ['pages', 'comments', 'messages', 'insights'],
};

export async function GET() {
  const db = readDb();
  return NextResponse.json({
    accounts: db.accounts,
    publishingMode: getPublishingMode(),
  });
}

export async function POST(request: NextRequest) {
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

  const db = readDb();
  const duplicate = db.accounts.find(
    (account) =>
      account.platform === platform &&
      account.handle.toLowerCase() === normalizedHandle.toLowerCase(),
  );
  if (duplicate) {
    return NextResponse.json(
      { error: `${normalizedHandle} is already connected on ${platform}.` },
      { status: 409 },
    );
  }

  const account: Account = {
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
    lastSyncedAt: new Date().toISOString(),
    scopes: DEFAULT_SCOPES[platform],
  };

  db.accounts.push(account);
  writeDb(db);
  return NextResponse.json({ account }, { status: 201 });
}
