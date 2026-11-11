import type {
  Account as PrismaAccount,
  AnalyticsPoint as PrismaAnalyticsPoint,
  AppNotification as PrismaNotification,
  Prisma,
} from '@prisma/client';
import { prisma } from './prisma';
import {
  seedAccounts,
  seedConversations,
  seedNotifications,
  seedPosts,
  seededAnalytics,
} from './seed';
import type {
  Account,
  AnalyticsPoint,
  AppNotification,
  Conversation,
  Platform,
  Post,
  PostStatus,
} from './types';

// Data-access layer: Prisma rows in, the app's plain types out. API routes
// and the overview/analytics/scheduler libs work with these shapes exactly
// as they did with the old JSON store, so their logic is unchanged.

type PostRow = Prisma.PostGetPayload<{
  include: { media: true; postAccounts: true; overrides: true };
}>;

type ConversationRow = Prisma.ConversationGetPayload<{
  include: { messages: true };
}>;

// ---------- serializers ----------

export function serializeAccount(row: PrismaAccount): Account {
  return {
    id: row.id,
    platform: row.platform as Platform,
    connected: row.connected,
    handle: row.handle,
    displayName: row.displayName,
    followers: row.followers,
    followerChange: row.followerChange,
    engagementRate: row.engagementRate,
    reach30d: row.reach30d,
    health: row.health as Account['health'],
    lastSyncedAt: row.lastSyncedAt.toISOString(),
    scopes: [...row.scopes],
    isPrimary: row.isPrimary,
  };
}

export function serializePost(row: PostRow): Post {
  return {
    id: row.id,
    title: row.title ?? undefined,
    caption: row.caption,
    platforms: [...row.platforms] as Platform[],
    accountIds: row.postAccounts.map((link) => link.accountId),
    media: [...row.media]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((item) => ({
        id: item.id,
        url: item.url,
        type: item.type as 'image' | 'video',
        alt: item.alt ?? undefined,
      })),
    status: row.status as PostStatus,
    scheduledAt: row.scheduledAt?.toISOString(),
    publishedAt: row.publishedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    autoPublish: row.autoPublish,
    metrics: {
      impressions: row.impressions,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      saves: row.saves,
    },
    tags: [...row.tags],
    aiGenerated: row.aiGenerated,
    overrides:
      row.overrides.length > 0
        ? (Object.fromEntries(row.overrides.map((o) => [o.platform, o.text])) as Post['overrides'])
        : undefined,
  };
}

export function serializeConversation(row: ConversationRow): Conversation {
  return {
    id: row.id,
    type: row.type as Conversation['type'],
    platform: row.platform as Platform,
    accountId: row.accountId ?? '',
    participant: {
      name: row.participantName,
      handle: row.participantHandle,
      avatar: row.participantAvatar ?? undefined,
    },
    subject: row.subject ?? undefined,
    preview: row.preview,
    unread: row.unread,
    starred: row.starred,
    status: row.status as Conversation['status'],
    lastMessageAt: row.lastMessageAt.toISOString(),
    messages: [...row.messages]
      .sort(
        (a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime() ||
          a.id.localeCompare(b.id),
      )
      .map((message) => ({
        id: message.id,
        from: message.from as 'them' | 'me',
        text: message.text,
        createdAt: message.createdAt.toISOString(),
      })),
    postId: row.postId ?? undefined,
  };
}

export function serializeNotification(row: PrismaNotification): AppNotification {
  return {
    id: row.id,
    type: row.type as AppNotification['type'],
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    read: row.read,
    platform: (row.platform as Platform | undefined) ?? undefined,
    accountId: row.accountId ?? undefined,
  };
}

export function serializeAnalyticsPoint(row: PrismaAnalyticsPoint): AnalyticsPoint {
  return {
    date: row.date,
    reach: row.reach,
    engagement: row.engagement,
    followers: row.followers,
  };
}

// ---------- loaders (read path) ----------

const postInclude = {
  media: true,
  postAccounts: true,
  overrides: true,
} as const;

const conversationInclude = { messages: true } as const;

export async function getAccounts(): Promise<Account[]> {
  const rows = await prisma.account.findMany({ orderBy: { sortOrder: 'asc' } });
  return rows.map(serializeAccount);
}

export async function getPosts(): Promise<Post[]> {
  const rows = await prisma.post.findMany({
    include: postInclude,
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serializePost);
}

export async function getPostById(id: string): Promise<Post | null> {
  const row = await prisma.post.findUnique({
    where: { id },
    include: postInclude,
  });
  return row ? serializePost(row) : null;
}

export async function getConversations(): Promise<Conversation[]> {
  const rows = await prisma.conversation.findMany({
    include: conversationInclude,
    orderBy: { lastMessageAt: 'desc' },
  });
  return rows.map(serializeConversation);
}

export async function getConversationById(id: string): Promise<Conversation | null> {
  const row = await prisma.conversation.findUnique({
    where: { id },
    include: conversationInclude,
  });
  return row ? serializeConversation(row) : null;
}

export async function getNotifications(): Promise<AppNotification[]> {
  const rows = await prisma.appNotification.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return rows.map(serializeNotification);
}

export async function getAnalytics(): Promise<AnalyticsPoint[]> {
  const rows = await prisma.analyticsPoint.findMany({ orderBy: { date: 'asc' } });
  return rows.map(serializeAnalyticsPoint);
}

// ---------- write helpers (used by the API routes) ----------

function postCreateData(post: Post) {
  return {
    id: post.id,
    title: post.title || null,
    caption: post.caption,
    platforms: post.platforms,
    status: post.status,
    scheduledAt: post.scheduledAt ? new Date(post.scheduledAt) : null,
    publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
    createdAt: new Date(post.createdAt),
    updatedAt: new Date(post.updatedAt),
    autoPublish: post.autoPublish,
    impressions: post.metrics.impressions,
    likes: post.metrics.likes,
    comments: post.metrics.comments,
    shares: post.metrics.shares,
    saves: post.metrics.saves,
    tags: post.tags,
    aiGenerated: post.aiGenerated,
    media: {
      // Fresh ids per row: the same image can appear in several posts, and
      // each post owns its own media rows (MediaAsset.postId is a FK).
      create: post.media.map((item, index) => ({
        url: item.url,
        type: item.type,
        alt: item.alt ?? null,
        sortOrder: index,
      })),
    },
    postAccounts: {
      create: post.accountIds.map((accountId) => ({ accountId })),
    },
    overrides: post.overrides
      ? {
          create: Object.entries(post.overrides).map(([platform, text]) => ({
            platform,
            text: text as string,
          })),
        }
      : undefined,
  };
}

/** Insert a fully-built post (media, account links, overrides included). */
export async function createPostRecord(post: Post): Promise<Post> {
  const created = await prisma.post.create({
    data: postCreateData(post),
    include: postInclude,
  });
  return serializePost(created);
}

/** Persist a post object after in-memory mutation: replaces its media,
 *  account links and overrides, then updates the scalar fields. */
export async function savePost(post: Post): Promise<Post> {
  const updated = await prisma.$transaction(async (tx) => {
    await tx.mediaAsset.deleteMany({ where: { postId: post.id } });
    await tx.postAccount.deleteMany({ where: { postId: post.id } });
    await tx.postOverride.deleteMany({ where: { postId: post.id } });
    return tx.post.update({
      where: { id: post.id },
      data: postCreateData(post),
      include: postInclude,
    });
  });
  return serializePost(updated);
}

export async function addNotification(input: {
  type: AppNotification['type'];
  title: string;
  body: string;
  platform?: string;
  accountId?: string;
}): Promise<void> {
  await prisma.appNotification.create({
    data: {
      id: crypto.randomUUID(),
      type: input.type,
      title: input.title,
      body: input.body,
      createdAt: new Date(),
      read: false,
      platform: input.platform ?? null,
      accountId: input.accountId ?? null,
    },
  });
}

// ---------- demo content: seed + reset ----------

/** Insert the demo workspace (accounts, posts, conversations, notifications,
 *  analytics). Callers must ensure the content tables are empty first. */
export async function seedWorkspaceContent(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.account.createMany({
      data: seedAccounts.map((account, index) => ({
        id: account.id,
        platform: account.platform,
        connected: account.connected,
        handle: account.handle,
        displayName: account.displayName,
        followers: account.followers,
        followerChange: account.followerChange,
        engagementRate: account.engagementRate,
        reach30d: account.reach30d,
        health: account.health,
        lastSyncedAt: new Date(account.lastSyncedAt),
        scopes: account.scopes,
        isPrimary: account.isPrimary ?? false,
        sortOrder: index,
      })),
    });

    for (const post of seedPosts) {
      await tx.post.create({
        data: {
          id: post.id,
          title: post.title || null,
          caption: post.caption,
          platforms: post.platforms,
          status: post.status,
          scheduledAt: post.scheduledAt ? new Date(post.scheduledAt) : null,
          publishedAt: post.publishedAt ? new Date(post.publishedAt) : null,
          createdAt: new Date(post.createdAt),
          updatedAt: new Date(post.updatedAt),
          autoPublish: post.autoPublish,
          impressions: post.metrics.impressions,
          likes: post.metrics.likes,
          comments: post.metrics.comments,
          shares: post.metrics.shares,
          saves: post.metrics.saves,
          tags: post.tags,
          aiGenerated: post.aiGenerated,
          media: {
            create: post.media.map((item, index) => ({
              url: item.url,
              type: item.type,
              alt: item.alt ?? null,
              sortOrder: index,
            })),
          },
          postAccounts: {
            create: post.accountIds.map((accountId) => ({ accountId })),
          },
          overrides: post.overrides
            ? {
                create: Object.entries(post.overrides).map(([platform, text]) => ({
                  platform,
                  text: text as string,
                })),
              }
            : undefined,
        },
      });
    }

    for (const conversation of seedConversations) {
      await tx.conversation.create({
        data: {
          id: conversation.id,
          type: conversation.type,
          platform: conversation.platform,
          accountId: conversation.accountId,
          participantName: conversation.participant.name,
          participantHandle: conversation.participant.handle,
          participantAvatar: conversation.participant.avatar ?? null,
          subject: conversation.subject ?? null,
          preview: conversation.preview,
          unread: conversation.unread,
          starred: conversation.starred,
          status: conversation.status,
          lastMessageAt: new Date(conversation.lastMessageAt),
          postId: conversation.postId ?? null,
          messages: {
            create: conversation.messages.map((message) => ({
              id: message.id,
              from: message.from,
              text: message.text,
              createdAt: new Date(message.createdAt),
            })),
          },
        },
      });
    }

    await tx.appNotification.createMany({
      data: seedNotifications.map((notification) => ({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        createdAt: new Date(notification.createdAt),
        read: notification.read,
        platform: notification.platform ?? null,
        accountId: notification.accountId ?? null,
      })),
    });

    await tx.analyticsPoint.createMany({
      data: seededAnalytics().map((point) => ({
        date: point.date,
        reach: point.reach,
        engagement: point.engagement,
        followers: point.followers,
      })),
    });
  });
}

/**
 * Wipe the workspace content tables and re-seed the demo workspace. Users
 * and their AI settings are untouched — a connected provider key survives
 * a reset, exactly like before.
 */
export async function resetWorkspaceContent(): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.conversationMessage.deleteMany();
    await tx.mediaAsset.deleteMany();
    await tx.postAccount.deleteMany();
    await tx.postOverride.deleteMany();
    await tx.conversation.deleteMany();
    await tx.appNotification.deleteMany();
    await tx.post.deleteMany();
    await tx.analyticsPoint.deleteMany();
    await tx.account.deleteMany();
  });
  await seedWorkspaceContent();
}
