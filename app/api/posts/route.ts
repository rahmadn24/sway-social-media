import { NextRequest, NextResponse } from 'next/server';
import type { MediaAsset, Platform, Post, PostStatus } from '@/lib/types';
import { platformsForAccountIds, resolveAccountIds } from '@/lib/accounts';
import { publishPostToAccounts } from '@/lib/publishing';
import { readDb, writeDb } from '@/lib/store';

export const dynamic = 'force-dynamic';

const STATUSES: PostStatus[] = ['draft', 'scheduled', 'published', 'failed'];

function parseMedia(value: unknown): MediaAsset[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry) => ({
      id: typeof entry.id === 'string' ? entry.id : crypto.randomUUID(),
      url: typeof entry.url === 'string' ? entry.url : '',
      type: entry.type === 'video' ? ('video' as const) : ('image' as const),
      alt: typeof entry.alt === 'string' ? entry.alt : undefined,
    }))
    .filter((entry) => entry.url.startsWith('/') || entry.url.startsWith('http'));
}

function countsFor(posts: Post[]) {
  return {
    all: posts.length,
    draft: posts.filter((post) => post.status === 'draft').length,
    scheduled: posts.filter((post) => post.status === 'scheduled').length,
    published: posts.filter((post) => post.status === 'published').length,
    failed: posts.filter((post) => post.status === 'failed').length,
  };
}

export async function GET(request: NextRequest) {
  const db = readDb();
  const params = request.nextUrl.searchParams;
  const status = params.get('status');
  const platform = params.get('platform');
  const accountId = params.get('accountId');
  const query = params.get('q')?.trim().toLowerCase();
  const sort = params.get('sort') ?? 'updated';

  let posts = [...db.posts];

  if (status && status !== 'all' && STATUSES.includes(status as PostStatus)) {
    posts = posts.filter((post) => post.status === status);
  }
  if (platform && platform !== 'all') {
    posts = posts.filter((post) => post.platforms.includes(platform as Platform));
  }
  if (accountId && accountId !== 'all') {
    posts = posts.filter((post) => post.accountIds.includes(accountId));
  }
  if (query) {
    posts = posts.filter((post) =>
      `${post.title ?? ''} ${post.caption} ${post.tags.join(' ')}`
        .toLowerCase()
        .includes(query),
    );
  }

  posts.sort((a, b) => {
    if (sort === 'engagement') {
      return b.metrics.impressions - a.metrics.impressions;
    }
    if (a.status === 'scheduled' && b.status === 'scheduled') {
      return (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? '');
    }
    if (a.status === 'scheduled' && b.status !== 'scheduled') return -1;
    if (b.status === 'scheduled' && a.status !== 'scheduled') return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return NextResponse.json({
    posts,
    counts: countsFor(db.posts),
    total: posts.length,
  });
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }

  const db = readDb();
  const caption = typeof body.caption === 'string' ? body.caption.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const accountIds = resolveAccountIds(db.accounts, {
    accountIds: body.accountIds,
    platforms: body.platforms,
  });
  const platforms = platformsForAccountIds(db.accounts, accountIds);
  const media = parseMedia(body.media);
  const status = (body.status as PostStatus) || 'draft';
  const autoPublish = body.autoPublish !== false;
  const scheduledAt = typeof body.scheduledAt === 'string' ? body.scheduledAt : undefined;
  const aiGenerated = Boolean(body.aiGenerated);
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 5)
    : [];
  const overrides =
    body.overrides && typeof body.overrides === 'object'
      ? (body.overrides as Post['overrides'])
      : undefined;

  const requestedAccountIds = Array.isArray(body.accountIds) ? body.accountIds : [];
  if (requestedAccountIds.length > 0 && accountIds.length === 0) {
    return NextResponse.json(
      { error: 'None of the selected accounts are connected to this workspace.' },
      { status: 400 },
    );
  }

  if (!caption && media.length === 0) {
    return NextResponse.json({ error: 'Add a caption or media before saving.' }, { status: 400 });
  }
  if (accountIds.length === 0 && status !== 'draft') {
    return NextResponse.json({ error: 'Choose at least one account.' }, { status: 400 });
  }
  if (!STATUSES.includes(status)) {
    return NextResponse.json({ error: 'Unknown post status.' }, { status: 400 });
  }
  if (status === 'scheduled' && !scheduledAt) {
    return NextResponse.json({ error: 'Choose a date and time to schedule this post.' }, { status: 400 });
  }
  if (status === 'scheduled' && new Date(scheduledAt as string).getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: 'The scheduled time is in the past.' }, { status: 400 });
  }
  const selectedAccounts = db.accounts.filter((account) => accountIds.includes(account.id));
  const disconnected = selectedAccounts.filter((account) => !account.connected);
  if (status !== 'draft' && disconnected.length > 0) {
    return NextResponse.json(
      {
        error: `${disconnected.map((account) => account.displayName).join(', ')} ${
          disconnected.length === 1 ? 'is' : 'are'
        } disconnected. Reconnect before publishing.`,
      },
      { status: 400 },
    );
  }
  if (
    (platforms.includes('instagram') || platforms.includes('tiktok')) &&
    media.length === 0 &&
    status !== 'draft'
  ) {
    return NextResponse.json(
      { error: 'Instagram and TikTok need at least one image or video.' },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const post: Post = {
    id: `post_${crypto.randomUUID().slice(0, 8)}`,
    title: title || caption.split('\n')[0].slice(0, 90),
    caption,
    platforms,
    accountIds,
    media,
    status,
    scheduledAt: status === 'scheduled' ? new Date(scheduledAt as string).toISOString() : undefined,
    publishedAt: status === 'published' ? now : undefined,
    createdAt: now,
    updatedAt: now,
    autoPublish,
    metrics: { impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 },
    tags,
    aiGenerated,
    overrides,
  };

  if (status === 'published') {
    const results = await publishPostToAccounts(post, db.accounts);
    if (!results.some((result) => result.ok)) {
      return NextResponse.json(
        { error: results[0]?.error ?? 'Could not publish this post.' },
        { status: 409 },
      );
    }
    const successes = results.filter((result) => result.ok);
    db.notifications.unshift({
      id: crypto.randomUUID(),
      type: 'post',
      title: 'Post published',
      body: `“${post.title}” is now live on ${successes.length} account${successes.length === 1 ? '' : 's'}: ${successes.map((result) => result.accountLabel).join(', ')}.`,
      createdAt: now,
      read: false,
    });
    if (successes.length < results.length) {
      const failures = results.filter((result) => !result.ok);
      db.notifications.unshift({
        id: crypto.randomUUID(),
        type: 'post',
        title: 'Some accounts could not publish',
        body: failures.map((result) => `${result.accountLabel}: ${result.error}`).join(' · '),
        createdAt: now,
        read: false,
      });
    }
  }

  db.posts.unshift(post);
  writeDb(db);
  return NextResponse.json({ post }, { status: 201 });
}
