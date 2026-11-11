import { getAccounts, getAnalytics, getPosts } from './db';
import { parseRange, type OverviewRange } from './overview';
import { PLATFORMS } from './types';
import type {
  Account,
  AccountPerformance,
  AnalyticsData,
  AnalyticsPoint,
  AudienceSlice,
  FormatPerformance,
  HeatmapCell,
  PlatformPerformance,
  Post,
} from './types';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOT_LABELS = ['6–9am', '9–12pm', '12–3pm', '3–6pm', '6–9pm', '9–12am'];

export function parseAnalyticsRange(value: string | null): OverviewRange {
  return parseRange(value);
}

function percentageChange(current: number, previous: number): number {
  if (!previous) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function engagementOf(post: Post): number {
  return post.metrics.likes + post.metrics.comments + post.metrics.shares + post.metrics.saves;
}

function within(dateValue: string | undefined, cutoff: number): boolean {
  if (!dateValue) return false;
  return new Date(dateValue).getTime() >= cutoff;
}

function audienceFor(days: number) {
  const shift = days === 7 ? 1 : days === 90 ? -1 : 0;
  const age: AudienceSlice[] = [
    { label: '18–24', value: 21 + shift },
    { label: '25–34', value: 42 },
    { label: '35–44', value: 25 - shift },
    { label: '45–54', value: 9 },
    { label: '55+', value: 3 },
  ];

  const gender: AudienceSlice[] = [
    { label: 'Women', value: 67 },
    { label: 'Men', value: 28 },
    { label: 'Other', value: 5 },
  ];

  const locations: AudienceSlice[] = [
    { label: 'London', value: 26 },
    { label: 'New York', value: 18 },
    { label: 'Copenhagen', value: 12 },
    { label: 'Berlin', value: 9 },
    { label: 'Melbourne', value: 8 },
    { label: 'Everywhere else', value: 27 },
  ];

  const activeHours = Array.from({ length: 24 }, (_, hour) => {
    const morning = Math.exp(-((hour - 8) ** 2) / 6) * 55;
    const lunch = Math.exp(-((hour - 13) ** 2) / 8) * 42;
    const evening = Math.exp(-((hour - 19) ** 2) / 9) * 78;
    const late = Math.exp(-((hour - 22) ** 2) / 5) * 30;
    return Math.min(100, Math.round(12 + morning + lunch + evening + late));
  });

  return { age, gender, locations, activeHours };
}

function buildHeatmap(): { heatmap: HeatmapCell[]; bestDay: string; bestHour: string } {
  const dayBias = [0.84, 0.94, 1.03, 1.12, 1.06, 0.9, 0.78];
  const slotBias = [0.55, 0.82, 1.04, 0.92, 1.2, 0.76];

  const values = dayBias.map((dayFactor, dayIndex) =>
    slotBias.map((slotFactor, slotIndex) => {
      const wave = 0.94 + 0.08 * Math.sin(dayIndex * 1.7 + slotIndex * 2.3);
      return Math.round(Math.min(0.98, Math.max(0.12, dayFactor * slotFactor * wave)) * 100);
    }),
  );

  const heatmap: HeatmapCell[] = [];
  values.forEach((row, dayIndex) => {
    row.forEach((value, slotIndex) => {
      heatmap.push({
        day: DAY_LABELS[dayIndex],
        slot: SLOT_LABELS[slotIndex],
        value,
      });
    });
  });

  const dayTotals = values.map((row) => row.reduce((total, value) => total + value, 0));
  const slotTotals = SLOT_LABELS.map((_, slotIndex) =>
    values.reduce((total, row) => total + row[slotIndex], 0),
  );
  const bestDay = DAY_LABELS[dayTotals.indexOf(Math.max(...dayTotals))];
  const bestHour = SLOT_LABELS[slotTotals.indexOf(Math.max(...slotTotals))];
  return { heatmap, bestDay, bestHour };
}

function buildFormats(posts: Post[]): FormatPerformance[] {
  const buckets: Record<string, Post[]> = {
    Video: [],
    Carousel: [],
    Image: [],
    'Text only': [],
  };

  posts.forEach((post) => {
    if (post.media.some((item) => item.type === 'video')) buckets.Video.push(post);
    else if (post.media.length > 1) buckets.Carousel.push(post);
    else if (post.media.length === 1) buckets.Image.push(post);
    else buckets['Text only'].push(post);
  });

  return Object.entries(buckets)
    .filter(([, bucketPosts]) => bucketPosts.length > 0)
    .map(([label, bucketPosts]) => {
      const reach = bucketPosts.reduce((total, post) => total + post.metrics.impressions, 0);
      const engagement = bucketPosts.reduce((total, post) => total + engagementOf(post), 0);
      return {
        label,
        posts: bucketPosts.length,
        reach,
        engagementRate: reach ? Number(((engagement / reach) * 100).toFixed(1)) : 0,
      };
    });
}

function buildAccounts(
  accounts: Account[],
  posts: Post[],
  days: number,
): AccountPerformance[] {
  const published = posts.filter((post) => post.status === 'published');

  const rows: AccountPerformance[] = accounts.map((account) => {
    const credited = published.filter((post) => post.accountIds.includes(account.id));
    const reach = Math.round(account.reach30d * (days / 30));
    let impressions = 0;
    let engagement = 0;

    credited.forEach((post) => {
      // A post published to several accounts shares its aggregate metrics evenly,
      // otherwise every account would claim the full result.
      const divisor = Math.max(post.accountIds.length, 1);
      impressions += post.metrics.impressions / divisor;
      engagement += engagementOf(post) / divisor;
    });

    return {
      accountId: account.id,
      platform: account.platform,
      displayName: account.displayName,
      handle: account.handle,
      connected: account.connected,
      followers: account.followers,
      followerChange: account.followerChange,
      engagementRate: account.engagementRate,
      reach,
      impressions: Math.round(impressions),
      posts: credited.length,
      engagement: Math.round(engagement),
      share: 0,
    };
  });

  const totalReach = rows.reduce((total, row) => total + row.reach, 0) || 1;
  rows.forEach((row) => {
    row.share = Number(((row.reach / totalReach) * 100).toFixed(1));
  });

  return rows.sort((a, b) => b.reach - a.reach);
}

function buildPlatforms(
  accounts: Account[],
  accountRows: AccountPerformance[],
  posts: Post[],
  days: number,
): PlatformPerformance[] {
  const published = posts.filter((post) => post.status === 'published');
  const rows: PlatformPerformance[] = [];

  for (const platform of PLATFORMS) {
    const platformAccounts = accounts.filter((account) => account.platform === platform);
    if (platformAccounts.length === 0) continue;

    const rowsForPlatform = accountRows.filter((row) => row.platform === platform);
    const followers = rowsForPlatform.reduce((total, row) => total + row.followers, 0);
    const followerWeight = rowsForPlatform.reduce(
      (total, row) => total + row.followers * row.followerChange,
      0,
    );
    const reach = rowsForPlatform.reduce((total, row) => total + row.reach, 0);
    const impressions = rowsForPlatform.reduce((total, row) => total + row.impressions, 0);
    const engagement = rowsForPlatform.reduce((total, row) => total + row.engagement, 0);
    const platformPosts = published.filter((post) => post.platforms.includes(platform));
    const weightedRate = followers
      ? rowsForPlatform.reduce((total, row) => total + row.engagementRate * row.followers, 0) /
        followers
      : 0;

    rows.push({
      platform,
      accounts: platformAccounts.length,
      followers,
      followerChange: followers
        ? Number((followerWeight / followers).toFixed(1))
        : 0,
      engagementRate: impressions
        ? Number(((engagement / impressions) * 100).toFixed(1))
        : Number(weightedRate.toFixed(1)),
      reach,
      impressions,
      posts: platformPosts.length,
      engagement,
      share: 0,
    });
  }

  const totalReach = rows.reduce((total, row) => total + row.reach, 0) || 1;
  rows.forEach((row) => {
    row.share = Number(((row.reach / totalReach) * 100).toFixed(1));
  });

  return rows.sort((a, b) => b.reach - a.reach);
}

export async function buildAnalytics(range: OverviewRange = '30d'): Promise<AnalyticsData> {
  const [accounts, analytics, posts] = await Promise.all([
    getAccounts(),
    getAnalytics(),
    getPosts(),
  ]);
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const now = Date.now();
  const cutoff = now - days * 86_400_000;

  const recent = analytics.slice(-days);
  const previous = analytics.slice(-(days * 2), -days);
  const reach = recent.reduce((total, point) => total + point.reach, 0);
  const engagement = recent.reduce((total, point) => total + point.engagement, 0);
  const previousReach = previous.reduce((total, point) => total + point.reach, 0);
  const previousEngagement = previous.reduce((total, point) => total + point.engagement, 0);

  const followers = accounts.reduce((total, account) => total + account.followers, 0);
  const followerWeight = accounts.reduce(
    (total, account) => total + account.followers * account.followerChange,
    0,
  );
  const followersChange = followers
    ? Number((followerWeight / followers).toFixed(1))
    : 0;
  const netFollowers =
    recent.length > 1 ? Math.max(0, recent[recent.length - 1].followers - recent[0].followers) : 0;

  const publishedInRange = posts.filter(
    (post) => post.status === 'published' && within(post.publishedAt, cutoff),
  );
  const publishedCount = publishedInRange.length;
  const avgPostReach = publishedCount
    ? Math.round(
        publishedInRange.reduce((total, post) => total + post.metrics.impressions, 0) /
          publishedCount,
      )
    : 0;

  const topPosts = [...(publishedInRange.length ? publishedInRange : posts.filter((post) => post.status === 'published'))]
    .sort((a, b) => {
      const scoreA = engagementOf(a) + a.metrics.impressions * 0.02;
      const scoreB = engagementOf(b) + b.metrics.impressions * 0.02;
      return scoreB - scoreA;
    })
    .slice(0, 5);

  const { heatmap, bestDay, bestHour } = buildHeatmap();
  const accountRows = buildAccounts(accounts, posts, days);

  return {
    range,
    totals: {
      reach,
      reachChange: percentageChange(reach, previousReach),
      engagement,
      engagementChange: percentageChange(engagement, previousEngagement),
      followers,
      followersChange,
      engagementRate: reach ? Number(((engagement / reach) * 100).toFixed(1)) : 0,
      publishedCount,
      avgPostReach,
      netFollowers,
    },
    chart: recent as AnalyticsPoint[],
    platforms: buildPlatforms(accounts, accountRows, posts, days),
    accounts: accountRows,
    audience: audienceFor(days),
    topPosts,
    heatmap,
    bestDay,
    bestHour,
    formats: buildFormats(publishedInRange.length ? publishedInRange : posts.filter((post) => post.status === 'published')),
  };
}
