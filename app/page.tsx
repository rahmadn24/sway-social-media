'use client';

import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  Heart,
  Inbox,
  MessageCircle,
  Plus,
  Radio,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Account, Conversation, OverviewData, Platform, Post } from '@/lib/types';
import { accountsSummary } from '@/lib/accounts';
import { apiRequest } from '@/lib/client';
import {
  formatCompact,
  formatPercent,
  formatRelative,
  formatScheduled,
  formatLongDate,
} from '@/lib/format';
import { PLATFORM_META } from '@/lib/platforms';
import { PerformanceChart, Sparkline } from '@/components/PerformanceChart';
import { MediaThumb } from '@/components/MediaThumb';
import {
  Avatar,
  LiveDot,
  PageHeader,
  PlatformIcon,
  PlatformStack,
  Skeleton,
  StatusBadge,
} from '@/components/ui';

const RANGES = [
  { id: '7d', label: '7D' },
  { id: '30d', label: '30D' },
  { id: '90d', label: '90D' },
] as const;

type Range = (typeof RANGES)[number]['id'];

export default function OverviewPage() {
  const [range, setRange] = useState<Range>('30d');
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateLabel, setDateLabel] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDateLabel(formatLongDate(new Date()));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    apiRequest<OverviewData>(`/api/overview?range=${range}`)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range]);

  const followersSeries = data?.chart.slice(-10).map((point) => point.followers) ?? [];
  const reachSeries = data?.chart.slice(-10).map((point) => point.reach) ?? [];
  const engagementSeries = data?.chart.slice(-10).map((point) => point.engagement) ?? [];
  const nextPost = data?.upcoming[0];
  const followerShare = data?.accounts.reduce((total, account) => total + account.followers, 0) ?? 0;

  return (
    <div className="overview-page">
      <PageHeader
        className="dashboard-header"
        eyebrow={
          <span suppressHydrationWarning>
            {dateLabel || 'Your social workspace'}
            <span className="eyebrow-dot" />
            {data ? `${data.accounts.filter((account) => account.connected).length} channels connected` : 'Syncing channels'}
          </span>
        }
        title={
          <span className="greeting">
            Good morning, <em>Maya</em>.
          </span>
        }
        subtitle="A calm overview of what’s moving, what’s queued, and who’s waiting to hear from you."
        actions={
          <>
            <Link href="/studio" className="btn btn-secondary">
              <Sparkles size={15} />
              Ask Claude
            </Link>
            <Link href="/composer" className="btn btn-accent">
              <Plus size={15} />
              New post
            </Link>
          </>
        }
      />

      {error && (
        <div className="inline-error">
          <span>We couldn’t load your dashboard.</span>
          <button className="text-button" onClick={() => setRange(range)}>
            Try again
          </button>
        </div>
      )}

      <div className="metric-grid">
        <MetricCard
          label="Total reach"
          icon={<Radio size={15} />}
          value={data ? formatCompact(data.metrics.reach) : null}
          change={data?.metrics.reachChange}
          period="vs previous period"
          spark={reachSeries}
          sparkColor="#3b684f"
          loading={loading && !data}
        />
        <MetricCard
          label="Engagement"
          icon={<Heart size={15} />}
          value={data ? formatCompact(data.metrics.engagement) : null}
          change={data?.metrics.engagementChange}
          period={`${data ? formatPercent(data.metrics.engagementRate) : '—'} engagement rate`}
          spark={engagementSeries}
          sparkColor="#dd8c6d"
          loading={loading && !data}
        />
        <MetricCard
          label="Followers"
          icon={<Users size={15} />}
          value={data ? formatCompact(data.metrics.followers) : null}
          change={data?.metrics.followersChange}
          period="across five channels"
          spark={followersSeries}
          sparkColor="#d9f374"
          loading={loading && !data}
          dark
        />
        <Link href="/calendar" className="metric-card metric-card-queue">
          <div className="metric-top">
            <span className="metric-label">Content queue</span>
            <span className="metric-icon metric-icon-sage">
              <CalendarClock size={15} />
            </span>
          </div>
          {loading && !data ? (
            <Skeleton className="metric-skeleton-value" />
          ) : (
            <div className="metric-value">
              {data?.scheduledCount ?? 0}
              <span className="metric-value-suffix"> posts</span>
            </div>
          )}
          <div className="metric-foot">
            {nextPost ? (
              <>
                <span className="queue-live">
                  <LiveDot />
                  Up next {formatRelative(nextPost.scheduledAt ?? new Date())}
                </span>
                <span className="queue-arrow">
                  <ArrowUpRight size={14} />
                </span>
              </>
            ) : (
              <span className="metric-period">Your queue is clear</span>
            )}
          </div>
          <span className="metric-queue-bg">
            <CalendarDays size={112} strokeWidth={0.8} />
          </span>
        </Link>
      </div>

      <div className="overview-grid">
        <section className="card engagement-card">
          <div className="card-header chart-header">
            <div>
              <div className="chart-title-line">
                <h2 className="card-title">Engagement overview</h2>
                <span className="pill pill-accent">
                  <TrendingUp size={11} />
                  {data ? formatPercent(data.metrics.engagementChange, true) : '—'}
                </span>
              </div>
              <p className="card-subtitle">How your audience is responding over time.</p>
            </div>
            <div className="segmented" aria-label="Chart range">
              {RANGES.map((item) => (
                <button
                  key={item.id}
                  className={range === item.id ? 'is-active' : ''}
                  onClick={() => setRange(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className={`chart-body ${loading && data ? 'chart-refreshing' : ''}`}>
            {data ? (
              <PerformanceChart data={data.chart} />
            ) : (
              <div className="chart-skeleton">
                <Skeleton className="chart-skeleton-block" />
              </div>
            )}
            <div className="chart-legend">
              <span>
                <i className="legend-dot legend-dot-reach" /> Reach
              </span>
              <span>
                <i className="legend-dot legend-dot-engagement" /> Engagement
              </span>
              <span className="chart-note">Hover for the daily breakdown</span>
            </div>
          </div>
        </section>

        <section className="card channels-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Channel mix</h2>
              <p className="card-subtitle">
                {data ? `${formatCompact(data.metrics.followers)} people in your orbit` : 'Connecting your audience'}
              </p>
            </div>
            <Link href="/connections" className="icon-button icon-button-small" aria-label="Manage connections">
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <div className="channels-list">
            {data
              ? data.accounts.map((account) => (
                  <ChannelRow key={account.platform} account={account} followerShare={followerShare} />
                ))
              : Array.from({ length: 5 }).map((_, index) => (
                  <div className="channel-row channel-row-loading" key={index}>
                    <Skeleton className="channel-icon-skeleton" />
                    <Skeleton className="channel-copy-skeleton" />
                    <Skeleton className="channel-value-skeleton" />
                  </div>
                ))}
          </div>
          {data && (
            <div className="channel-mix-footer">
              <div className="audience-bar" aria-hidden="true">
                {data.accounts.map((account) => (
                  <span
                    key={account.platform}
                    style={{
                      width: `${(account.followers / followerShare) * 100}%`,
                      background: PLATFORM_META[account.platform].color,
                    }}
                  />
                ))}
              </div>
              <div className="audience-caption">
                <span>
                  <LiveDot /> {data.accounts.filter((account) => account.connected).length} accounts syncing
                </span>
                <span>Last sync just now</span>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="overview-lower">
        <section className="card upcoming-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Coming up</h2>
              <p className="card-subtitle">Your next posts, already in motion.</p>
            </div>
            <Link href="/calendar" className="text-link">
              Open calendar <ArrowRight size={13} />
            </Link>
          </div>
          <div className="upcoming-list">
            {data ? (
              data.upcoming.length ? (
                data.upcoming.slice(0, 3).map((post) => (
                  <UpcomingRow key={post.id} post={post} />
                ))
              ) : (
                <div className="mini-empty">
                  <CalendarDays size={20} />
                  <p>Your queue is clear. Plan the next one?</p>
                  <Link href="/composer" className="text-link">
                    Create a post <ArrowRight size={13} />
                  </Link>
                </div>
              )
            ) : (
              Array.from({ length: 3 }).map((_, index) => (
                <div className="upcoming-row" key={index}>
                  <Skeleton style={{ width: 56, height: 56, borderRadius: 13 }} />
                  <div className="upcoming-copy">
                    <Skeleton style={{ width: '56%', height: 11 }} />
                    <Skeleton style={{ width: '38%', height: 9, marginTop: 9 }} />
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="upcoming-foot">
            <span>
              <LiveDot /> Auto-publish is handling the queue
            </span>
            <Link href="/composer" className="btn btn-sm btn-secondary">
              <Plus size={13} /> Schedule another
            </Link>
          </div>
        </section>

        <section className="card inbox-preview-card">
          <div className="card-header">
            <div>
              <div className="inbox-title-line">
                <h2 className="card-title">Inbox</h2>
                {data && data.unreadCount > 0 && <span className="inbox-count">{data.unreadCount} new</span>}
              </div>
              <p className="card-subtitle">Real people, ready for a reply.</p>
            </div>
            <Link href="/inbox" className="text-link">
              Open inbox <ArrowRight size={13} />
            </Link>
          </div>
          <div className="inbox-preview-list">
            {data ? (
              data.inbox.map((conversation) => (
                <InboxRow key={conversation.id} conversation={conversation} />
              ))
            ) : (
              Array.from({ length: 4 }).map((_, index) => (
                <div className="inbox-preview-row" key={index}>
                  <Skeleton style={{ width: 34, height: 34, borderRadius: 99 }} />
                  <div className="inbox-preview-copy">
                    <Skeleton style={{ width: '44%', height: 10 }} />
                    <Skeleton style={{ width: '76%', height: 9, marginTop: 8 }} />
                  </div>
                </div>
              ))
            )}
          </div>
          <Link href="/inbox" className="inbox-footer-link">
            <Inbox size={14} />
            Reply to everyone in one place
            <ArrowUpRight size={13} />
          </Link>
        </section>
      </div>

      <section className="card winners-card">
        <div className="card-header">
          <div>
            <h2 className="card-title">Winning content</h2>
            <p className="card-subtitle">The posts doing the heaviest lifting this month.</p>
          </div>
          <Link href="/analytics" className="text-link">
            Full analytics <ArrowRight size={13} />
          </Link>
        </div>
        <div className="winners-grid">
          {data
            ? data.topPosts.map((post, index) => <WinnerRow post={post} rank={index + 1} key={post.id} />)
            : Array.from({ length: 3 }).map((_, index) => (
                <div className="winner-row" key={index}>
                  <Skeleton style={{ width: 76, height: 76, borderRadius: 14 }} />
                  <div className="winner-copy">
                    <Skeleton style={{ width: '80%', height: 11 }} />
                    <Skeleton style={{ width: '50%', height: 9, marginTop: 8 }} />
                  </div>
                </div>
              ))}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  icon,
  value,
  change,
  period,
  spark,
  sparkColor,
  loading,
  dark = false,
}: {
  label: string;
  icon: React.ReactNode;
  value: string | null;
  change?: number;
  period: string;
  spark: number[];
  sparkColor: string;
  loading?: boolean;
  dark?: boolean;
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <div className={`metric-card ${dark ? 'metric-card-dark' : ''}`}>
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className={`metric-icon ${dark ? 'metric-icon-dark' : ''}`}>{icon}</span>
      </div>
      {loading || value === null ? (
        <Skeleton className="metric-skeleton-value" />
      ) : (
        <div className="metric-value">{value}</div>
      )}
      <div className="metric-foot">
        {typeof change === 'number' ? (
          <span className={`delta ${positive ? 'delta-positive' : 'delta-negative'} ${dark ? 'delta-dark' : ''}`}>
            {positive ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
            {formatPercent(Math.abs(change))}
          </span>
        ) : (
          <Skeleton style={{ width: 50, height: 18 }} />
        )}
        <span className="metric-period">{period}</span>
      </div>
      {spark.length > 1 && (
        <span className="metric-spark">
          <Sparkline values={spark} color={sparkColor} width={112} height={42} fill={!dark} />
        </span>
      )}
    </div>
  );
}

function ChannelRow({ account, followerShare }: { account: Account; followerShare: number }) {
  const meta = PLATFORM_META[account.platform];
  return (
    <div className="channel-row">
      <PlatformIcon platform={account.platform} badge size={16} />
      <div className="channel-copy">
        <div className="channel-name-line">
          <strong>{meta.name}</strong>
          {!account.connected && <span className="channel-offline">Offline</span>}
          {account.health === 'expiring' && <span className="channel-expiring">Reconnect</span>}
        </div>
        <span>{account.handle}</span>
      </div>
      <div className="channel-values">
        <strong>{formatCompact(account.followers)}</strong>
        <span className="channel-growth">{formatPercent(account.followerChange, true)}</span>
      </div>
      <span className="channel-share-track" aria-hidden="true">
        <span
          style={{
            width: `${Math.max((account.followers / followerShare) * 100, 4)}%`,
            background: meta.color,
          }}
        />
      </span>
    </div>
  );
}

function UpcomingRow({ post }: { post: Post }) {
  return (
    <Link href={`/composer?edit=${post.id}`} className="upcoming-row">
      <MediaThumb media={post.media[0]} size={56} rounded={13} />
      <div className="upcoming-copy">
        <div className="upcoming-title">{post.title || post.caption.slice(0, 60)}</div>
        <div className="upcoming-meta">
          <PlatformStack platforms={post.platforms} size={11} />
          <span>{formatScheduled(post.scheduledAt)}</span>
          {post.autoPublish && (
            <span className="auto-tag">
              <LiveDot /> Auto
            </span>
          )}
        </div>
      </div>
      <span className="upcoming-arrow">
        <ArrowUpRight size={15} />
      </span>
    </Link>
  );
}

function InboxRow({ conversation }: { conversation: Conversation }) {
  return (
    <Link href={`/inbox?id=${conversation.id}`} className="inbox-preview-row">
      <span className="inbox-avatar">
        <Avatar
          name={conversation.participant.name}
          src={conversation.participant.avatar}
          size={34}
        />
        <PlatformIcon platform={conversation.platform} size={8} badge className="inbox-platform" />
      </span>
      <div className="inbox-preview-copy">
        <div className="inbox-name-line">
          <strong>{conversation.participant.name}</strong>
          <span>{formatRelative(conversation.lastMessageAt)}</span>
        </div>
        <p>{conversation.preview}</p>
      </div>
      {conversation.unread && <span className="unread-dot" aria-label="Unread" />}
    </Link>
  );
}

function WinnerRow({ post, rank }: { post: Post; rank: number }) {
  const totalEngagement = post.metrics.likes + post.metrics.comments + post.metrics.saves;
  return (
    <Link href={`/content?focus=${post.id}`} className="winner-row">
      <span className="winner-media">
        <MediaThumb media={post.media[0]} size={76} rounded={14} />
        <span className="winner-rank">0{rank}</span>
      </span>
      <div className="winner-copy">
        <div className="winner-platforms">
          <PlatformStack platforms={post.platforms} size={11} />
          <StatusBadge status={post.status} />
        </div>
        <h3>{post.title || post.caption.slice(0, 60)}</h3>
        <div className="winner-stats">
          <span>
            <MessageCircle size={12} /> {formatCompact(totalEngagement)} interactions
          </span>
          <span>{formatCompact(post.metrics.impressions)} views</span>
        </div>
      </div>
      <ArrowUpRight size={15} className="winner-arrow" />
    </Link>
  );
}
