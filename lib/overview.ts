import { getAccounts, getAnalytics, getConversations, getPosts } from './db';
import type { AnalyticsPoint, OverviewData } from './types';

export const OVERVIEW_RANGES = ['7d', '30d', '90d'] as const;
export type OverviewRange = (typeof OVERVIEW_RANGES)[number];

export function parseRange(value: string | null): OverviewRange {
  return OVERVIEW_RANGES.includes(value as OverviewRange) ? (value as OverviewRange) : '30d';
}

function percentageChange(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function sum(points: AnalyticsPoint[], key: 'reach' | 'engagement'): number {
  return points.reduce((total, point) => total + point[key], 0);
}

export async function buildOverview(range: OverviewRange = '30d'): Promise<OverviewData> {
  const [accounts, analytics, conversations, posts] = await Promise.all([
    getAccounts(),
    getAnalytics(),
    getConversations(),
    getPosts(),
  ]);
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const recent = analytics.slice(-days);
  const previous = analytics.slice(-(days * 2), -days);
  const reach = sum(recent, 'reach');
  const engagement = sum(recent, 'engagement');
  const previousReach = sum(previous, 'reach');
  const previousEngagement = sum(previous, 'engagement');

  const followers = accounts.reduce((total, account) => total + account.followers, 0);
  const followerWeight = accounts.reduce(
    (total, account) => total + account.followers * account.followerChange,
    0,
  );
  const followerChange = Number((followerWeight / followers).toFixed(1));
  const engagementRate = Number(((engagement / reach) * 100).toFixed(1));
  const now = Date.now();
  const scheduled = posts.filter((post) => post.status === 'scheduled');
  const upcoming = scheduled
    .filter((post) => !post.scheduledAt || new Date(post.scheduledAt).getTime() >= now)
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
    .slice(0, 4);

  return {
    metrics: {
      reach,
      reachChange: percentageChange(reach, previousReach),
      engagement,
      engagementChange: percentageChange(engagement, previousEngagement),
      followers,
      followersChange: followerChange,
      engagementRate,
    },
    chart: recent,
    scheduledCount: scheduled.length,
    unreadCount: conversations.filter((conversation) => conversation.unread).length,
    accounts,
    upcoming,
    inbox: [...conversations]
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
      .slice(0, 4),
    topPosts: posts
      .filter((post) => post.status === 'published')
      .sort((a, b) => b.metrics.impressions - a.metrics.impressions)
      .slice(0, 3),
  };
}
