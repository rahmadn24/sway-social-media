import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { platformsForAccountIds, resolveAccountIds } from '@/lib/accounts';
import { getAccounts, getPostById, savePost } from '@/lib/db';
import { prisma } from '@/lib/prisma';
import type { MediaAsset, Post, PostStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

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
    .filter((entry) => entry.url);
}

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const { id } = await context.params;
  const post = await getPostById(id);
  if (!post) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  return NextResponse.json({ post });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const { id } = await context.params;
  const post = await getPostById(id);
  if (!post) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }

  const accounts = await getAccounts();
  if (typeof body.caption === 'string') post.caption = body.caption.trim();
  if (typeof body.title === 'string') post.title = body.title.trim();
  if (Array.isArray(body.accountIds) || Array.isArray(body.platforms)) {
    const accountIds = resolveAccountIds(accounts, {
      accountIds: Array.isArray(body.accountIds) ? body.accountIds : undefined,
      platforms: Array.isArray(body.platforms) ? body.platforms : undefined,
    });
    if (Array.isArray(body.accountIds) && body.accountIds.length > 0 && accountIds.length === 0) {
      return NextResponse.json(
        { error: 'None of the selected accounts are connected to this workspace.' },
        { status: 400 },
      );
    }
    post.accountIds = accountIds;
    post.platforms = platformsForAccountIds(accounts, accountIds);
  }
  if (Array.isArray(body.media)) post.media = parseMedia(body.media);
  if (Array.isArray(body.tags)) {
    post.tags = body.tags.filter((tag): tag is string => typeof tag === 'string').slice(0, 5);
  }
  if (typeof body.autoPublish === 'boolean') post.autoPublish = body.autoPublish;
  if (typeof body.aiGenerated === 'boolean') post.aiGenerated = body.aiGenerated;
  if (body.overrides && typeof body.overrides === 'object') {
    post.overrides = body.overrides as Post['overrides'];
  }

  const nextStatus = body.status as PostStatus | undefined;
  if (nextStatus && ['draft', 'scheduled'].includes(nextStatus)) {
    if (post.status === 'published') {
      return NextResponse.json(
        { error: 'A published post can’t be moved back to draft or scheduled.' },
        { status: 409 },
      );
    }
    post.status = nextStatus;
  }

  if (typeof body.scheduledAt === 'string') {
    if (new Date(body.scheduledAt).getTime() < Date.now() - 60_000) {
      return NextResponse.json({ error: 'The scheduled time is in the past.' }, { status: 400 });
    }
    post.scheduledAt = new Date(body.scheduledAt).toISOString();
  }

  if (post.status === 'scheduled' && !post.scheduledAt) {
    return NextResponse.json({ error: 'Choose a date and time to schedule this post.' }, { status: 400 });
  }
  if (post.status !== 'draft' && post.accountIds.length === 0) {
    return NextResponse.json({ error: 'Choose at least one account.' }, { status: 400 });
  }
  const disconnected = accounts.filter(
    (account) => post.accountIds.includes(account.id) && !account.connected,
  );
  if (post.status !== 'draft' && disconnected.length > 0) {
    return NextResponse.json(
      {
        error: `${disconnected.map((account) => account.displayName).join(', ')} ${
          disconnected.length === 1 ? 'is' : 'are'
        } disconnected. Reconnect before publishing.`,
      },
      { status: 400 },
    );
  }
  if (!post.caption.trim() && post.media.length === 0) {
    return NextResponse.json({ error: 'Add a caption or media before saving.' }, { status: 400 });
  }
  if (
    (post.platforms.includes('instagram') || post.platforms.includes('tiktok')) &&
    post.media.length === 0 &&
    post.status !== 'draft'
  ) {
    return NextResponse.json(
      { error: 'Instagram and TikTok need at least one image or video.' },
      { status: 400 },
    );
  }
  if (post.status === 'draft') post.scheduledAt = undefined;

  post.updatedAt = new Date().toISOString();
  const saved = await savePost(post);
  return NextResponse.json({ post: saved });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = await prisma.post.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  await prisma.post.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
