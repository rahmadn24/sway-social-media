import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { createPostRecord, getPostById } from '@/lib/db';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const { id } = await context.params;
  const source = await getPostById(id);
  if (!source) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });

  const now = new Date().toISOString();
  const copy: Post = {
    ...structuredClone(source),
    id: `post_${crypto.randomUUID().slice(0, 8)}`,
    title: source.title ? `${source.title} (copy)` : source.title,
    status: 'draft',
    scheduledAt: undefined,
    publishedAt: undefined,
    createdAt: now,
    updatedAt: now,
    metrics: { impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 },
    // Fresh media rows: new ids, so the copy never shares a media row id
    // with the original.
    media: source.media.map((item) => ({ ...item, id: crypto.randomUUID() })),
  };
  const created = await createPostRecord(copy);
  return NextResponse.json({ post: created }, { status: 201 });
}
