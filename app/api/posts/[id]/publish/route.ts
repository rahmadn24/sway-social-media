import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/session';
import { publishPostToAccounts } from '@/lib/publishing';
import { addNotification, getAccounts, getPostById, savePost } from '@/lib/db';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  const { id } = await context.params;
  const post = await getPostById(id);
  if (!post) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  if (post.status === 'published') {
    return NextResponse.json({ error: 'This post is already published.' }, { status: 409 });
  }
  if (post.accountIds.length === 0 && post.platforms.length === 0) {
    return NextResponse.json({ error: 'Choose at least one account first.' }, { status: 400 });
  }

  const accounts = await getAccounts();
  const results = await publishPostToAccounts(post, accounts);
  const successes = results.filter((result) => result.ok);
  if (successes.length === 0) {
    post.status = 'failed';
    post.updatedAt = new Date().toISOString();
    await savePost(post);
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
  const saved = await savePost(post);
  await addNotification({
    type: 'post',
    title: 'Post published',
    body: `“${post.title || post.caption.slice(0, 52)}” is live on ${successes.length} account${successes.length === 1 ? '' : 's'}: ${successes.map((result) => result.accountLabel).join(', ')}.`,
  });
  if (results.length > successes.length) {
    await addNotification({
      type: 'post',
      title: 'Some accounts could not publish',
      body: results
        .filter((result) => !result.ok)
        .map((result) => `${result.accountLabel}: ${result.error}`)
        .join(' · '),
    });
  }
  return NextResponse.json({ post: saved, results });
}
