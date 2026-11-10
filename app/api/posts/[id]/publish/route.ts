import { NextRequest, NextResponse } from 'next/server';
import { publishPostToAccounts } from '@/lib/publishing';
import { readDb, writeDb } from '@/lib/store';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const db = readDb();
  const post = db.posts.find((candidate) => candidate.id === id);
  if (!post) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  if (post.status === 'published') {
    return NextResponse.json({ error: 'This post is already published.' }, { status: 409 });
  }
  if (post.accountIds.length === 0 && post.platforms.length === 0) {
    return NextResponse.json({ error: 'Choose at least one account first.' }, { status: 400 });
  }

  const results = await publishPostToAccounts(post, db.accounts);
  const successes = results.filter((result) => result.ok);
  if (successes.length === 0) {
    post.status = 'failed';
    post.updatedAt = new Date().toISOString();
    writeDb(db);
    return NextResponse.json(
      { error: results[0]?.error ?? 'Could not publish this post.', results },
      { status: 502 },
    );
  }

  const now = new Date().toISOString();
  post.status = 'published';
  post.publishedAt = now;
  post.scheduledAt = undefined;
  post.updatedAt = now;
  db.notifications.unshift({
    id: crypto.randomUUID(),
    type: 'post',
    title: 'Post published',
    body: `“${post.title || post.caption.slice(0, 52)}” is live on ${successes.length} account${successes.length === 1 ? '' : 's'}: ${successes.map((result) => result.accountLabel).join(', ')}.`,
    createdAt: now,
    read: false,
  });
  if (results.length > successes.length) {
    db.notifications.unshift({
      id: crypto.randomUUID(),
      type: 'post',
      title: 'Some accounts could not publish',
      body: results
        .filter((result) => !result.ok)
        .map((result) => `${result.accountLabel}: ${result.error}`)
        .join(' · '),
      createdAt: now,
      read: false,
    });
  }
  writeDb(db);
  return NextResponse.json({ post, results });
}
