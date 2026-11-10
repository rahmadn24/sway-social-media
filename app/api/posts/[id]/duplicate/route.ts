import { NextRequest, NextResponse } from 'next/server';
import { readDb, writeDb } from '@/lib/store';
import type { Post } from '@/lib/types';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const db = readDb();
  const source = db.posts.find((candidate) => candidate.id === id);
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
  };
  db.posts.unshift(copy);
  writeDb(db);
  return NextResponse.json({ post: copy }, { status: 201 });
}
