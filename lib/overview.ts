import { readDb } from './store';
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

export function buildOverview(range: OverviewRange = '30d'): OverviewData {
  const db = readDb();
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const recent = db.analytics.slice(-days);
  const previous = db.analytics.slice(-(days * 2), -days);
  const reach = sum(recent, 'reach');
  const engagement = sum(recent, 'engagement');
  const previousReach = sum(previous, 'reach');
  const previousEngagement = sum(previous, 'engagement');

  const followers = db.accounts.reduce((total, account) => total + account.followers, 0);
  const followerWeight = db.accounts.reduce(
    (total, account) => total + account.followers * account.followerChange,
    0,
  );
  const followerChange = Number((followerWeight / followers).toFixed(1));
  const engagementRate = Number(((engagement / reach) * 100).toFixed(1));
  const now = Date.now();
  const scheduled = db.posts.filter((post) => post.status === 'scheduled');
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
    unreadCount: db.conversations.filter((conversation) => conversation.unread).length,
    accounts: db.accounts,
    upcoming,
    inbox: [...db.conversations]
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt))
      .slice(0, 4),
    topPosts: db.posts
      .filter((post) => post.status === 'published')
      .sort((a, b) => b.metrics.impressions - a.metrics.impressions)
      .slice(0, 3),
  };
}
