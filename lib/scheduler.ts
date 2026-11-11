import { getAccounts, getPosts, serializePost } from './db';
import { prisma } from './prisma';
import { publishPostToAccounts } from './publishing';
import type { Post } from './types';

const globalForScheduler = globalThis as unknown as {
  __swayScheduler?: ReturnType<typeof setInterval>;
  __swaySchedulerRunning?: boolean;
};

export async function publishDuePosts(): Promise<Post[]> {
  if (globalForScheduler.__swaySchedulerRunning) return [];
  globalForScheduler.__swaySchedulerRunning = true;

  try {
    const [posts, accounts] = await Promise.all([getPosts(), getAccounts()]);
    const now = Date.now();
    const due = posts.filter(
      (post) =>
        post.status === 'scheduled' &&
        post.autoPublish &&
        post.scheduledAt &&
        new Date(post.scheduledAt).getTime() <= now,
    );

    if (due.length === 0) return [];

    const published: Post[] = [];
    for (const post of due) {
      const results = await publishPostToAccounts(post, accounts);
      const successes = results.filter((result) => result.ok);
      const failures = results.filter((result) => !result.ok);
      const stamp = new Date().toISOString();

      if (successes.length === 0) {
        await prisma.post.update({
          where: { id: post.id },
          data: { status: 'failed', updatedAt: new Date(stamp) },
        });
        await prisma.appNotification.create({
          data: {
            id: crypto.randomUUID(),
            type: 'system',
            title: 'Auto-publish needs your attention',
            body:
              failures[0]?.error ??
              `“${post.title || post.caption.slice(0, 48)}” could not be published.`,
            createdAt: new Date(stamp),
            read: false,
          },
        });
        continue;
      }

      const updated = await prisma.post.update({
        where: { id: post.id },
        data: { status: 'published', publishedAt: new Date(stamp), updatedAt: new Date(stamp) },
        include: { media: true, postAccounts: true, overrides: true },
      });
      published.push(serializePost(updated));
      await prisma.appNotification.create({
        data: {
          id: crypto.randomUUID(),
          type: 'post',
          title: 'Scheduled post published',
          body: `“${post.title || post.caption.slice(0, 52)}” is now live on ${successes.length} account${successes.length === 1 ? '' : 's'}: ${successes.map((result) => result.accountLabel).join(', ')}.`,
          createdAt: new Date(stamp),
          read: false,
        },
      });
      if (failures.length > 0) {
        await prisma.appNotification.create({
          data: {
            id: crypto.randomUUID(),
            type: 'system',
            title: 'Some accounts could not publish',
            body: failures
              .map((result) => `${result.accountLabel}: ${result.error}`)
              .join(' · '),
            createdAt: new Date(stamp),
            read: false,
          },
        });
      }
    }

    return published;
  } finally {
    globalForScheduler.__swaySchedulerRunning = false;
  }
}

export function startScheduler(): void {
  if (globalForScheduler.__swayScheduler) return;

  globalForScheduler.__swayScheduler = setInterval(() => {
    void publishDuePosts().catch((error) => {
      console.error('[sway] auto-publish failed', error);
    });
  }, 20_000);

  // Do not keep the Node process alive just for the demo scheduler.
  globalForScheduler.__swayScheduler.unref?.();

  setTimeout(() => {
    void publishDuePosts().catch(() => undefined);
  }, 4_000).unref?.();
}
