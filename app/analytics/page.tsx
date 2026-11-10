'use client';

import Link from 'next/link';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  Clock3,
  Download,
  Eye,
  FileText,
  Heart,
  MapPin,
  Radio,
  Send,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { AnalyticsData } from '@/lib/types';
import { PLATFORM_META } from '@/lib/platforms';
import { apiRequest } from '@/lib/client';
import { formatCompact, formatPercent, formatShortDate } from '@/lib/format';
import { PerformanceChart, Sparkline } from '@/components/PerformanceChart';
import { MediaThumb } from '@/components/MediaThumb';
import { useToast } from '@/components/ToastProvider';
import {
  PageHeader,
  PlatformIcon,
  PlatformStack,
  Skeleton,
  StatusBadge,
} from '@/components/ui';

const RANGES: Array<{ id: AnalyticsData['range']; label: string; long: string }> = [
  { id: '7d', label: '7D', long: 'Last 7 days' },
  { id: '30d', label: '30D', long: 'Last 30 days' },
  { id: '90d', label: '90D', long: 'Last 90 days' },
];

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [range, setRange] = useState<AnalyticsData['range']>('30d');
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    apiRequest<AnalyticsData>(`/api/analytics?range=${range}`)
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

  const rangeLabel = RANGES.find((item) => item.id === range)?.long ?? 'Last 30 days';
  const chart = data?.chart ?? [];
  const reachSeries = chart.map((point) => point.reach);
  const engagementSeries = chart.map((point) => point.engagement);
  const followerSeries = chart.map((point) => point.followers);
  const rateSeries = chart.map((point) =>
    point.reach ? Number(((point.engagement / point.reach) * 100).toFixed(2)) : 0,
  );

  function exportCsv() {
    if (!data) return;
    const rows: Array<Array<string | number>> = [
      [
        'Platform',
        'Followers',
        'Follower change %',
        'Reach',
        'Impressions',
        'Posts',
        'Engagement',
        'Engagement rate %',
        'Share of reach %',
      ],
      ...data.platforms.map((platform) => [
        PLATFORM_META[platform.platform].name,
        platform.followers,
        platform.followerChange,
        platform.reach,
        platform.impressions,
        platform.posts,
        platform.engagement,
        platform.engagementRate,
        platform.share,
      ]),
      [],
      ['Metric', 'Value'],
      ['Range', data.range],
      ['Total reach', data.totals.reach],
      ['Engagement', data.totals.engagement],
      ['Followers', data.totals.followers],
      ['Engagement rate %', data.totals.engagementRate],
      ['Published posts', data.totals.publishedCount],
      ['Average reach per post', data.totals.avgPostReach],
    ];
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
          .join(','),
      )
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `sway-analytics-${data.range}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast('Analytics report downloaded.');
  }

  return (
    <div className="analytics-page">
      <PageHeader
        eyebrow={
          <>
            Analytics
            <span className="eyebrow-dot" />
            {rangeLabel}
            <span className="eyebrow-dot" />
            <span suppressHydrationWarning>{formatShortDate(new Date().toISOString())}</span>
          </>
        }
        title={
          <>
            The story behind <em>the numbers</em>.
          </>
        }
        subtitle="What’s growing, what’s landing, and the moments your audience is actually paying attention."
        actions={
          <>
            <div className="segmented analytics-range" aria-label="Analytics range">
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
            <button className="btn btn-secondary" onClick={exportCsv} disabled={!data}>
              <Download size={14} />
              Export
            </button>
          </>
        }
      />

      {error && (
        <div className="inline-error">
          <span>We couldn’t load your analytics.</span>
          <button className="text-button" onClick={() => setRange(range)}>
            Try again
          </button>
        </div>
      )}

      <div className="metric-grid analytics-metrics">
        <AnalyticsMetric
          label="Total reach"
          icon={<Radio size={15} />}
          value={data ? formatCompact(data.totals.reach) : null}
          change={data?.totals.reachChange}
          period="vs previous period"
          spark={reachSeries}
          sparkColor="#3b684f"
          loading={loading && !data}
        />
        <AnalyticsMetric
          label="Engagement"
          icon={<Heart size={15} />}
          value={data ? formatCompact(data.totals.engagement) : null}
          change={data?.totals.engagementChange}
          period={`${data ? formatPercent(data.totals.engagementRate) : '—'} engagement rate`}
          spark={engagementSeries}
          sparkColor="#dd8c6d"
          loading={loading && !data}
        />
        <AnalyticsMetric
          label="Followers"
          icon={<Users size={15} />}
          value={data ? formatCompact(data.totals.followers) : null}
          change={data?.totals.followersChange}
          period={data ? `+${formatCompact(data.totals.netFollowers)} this period` : '—'}
          spark={followerSeries}
          sparkColor="#d9f374"
          loading={loading && !data}
          dark
        />
        <AnalyticsMetric
          label="Posts published"
          icon={<Send size={15} />}
          value={data ? String(data.totals.publishedCount) : null}
          period={data ? `${formatCompact(data.totals.avgPostReach)} avg reach per post` : '—'}
          spark={rateSeries}
          sparkColor="#b9c88e"
          loading={loading && !data}
          sage
        />
      </div>

      <div className="analytics-chart-grid">
        <section className="card analytics-chart-card">
          <div className="card-header chart-header">
            <div>
              <div className="chart-title-line">
                <h2 className="card-title">Performance over time</h2>
                {data && (
                  <span className="pill pill-accent">
                    <TrendingUp size={11} />
                    {formatPercent(data.totals.engagementChange, true)}
                  </span>
                )}
              </div>
              <p className="card-subtitle">Reach and engagement, day by day.</p>
            </div>
            <span className="analytics-updated">
              <Clock3 size={11} /> Updated just now
            </span>
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

        <section className="card platform-mix-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Channel mix</h2>
              <p className="card-subtitle">Share of reach by platform.</p>
            </div>
          </div>
          {data ? (
            <>
              <div className="platform-donut-wrap">
                <svg viewBox="0 0 42 42" className="platform-donut" role="img" aria-label="Reach share by platform">
                  <circle cx="21" cy="21" r="15.9155" fill="transparent" stroke="#f0efe9" strokeWidth="4.1" />
                  {(() => {
                    let offset = 0;
                    return data.platforms.map((platform) => {
                      const dash = Math.max(platform.share - 0.8, 0.4);
                      const element = (
                        <circle
                          key={platform.platform}
                          cx="21"
                          cy="21"
                          r="15.9155"
                          fill="transparent"
                          stroke={PLATFORM_META[platform.platform].color}
                          strokeWidth="4.1"
                          strokeDasharray={`${dash} ${100 - dash}`}
                          strokeDashoffset={-offset}
                          strokeLinecap="round"
                        />
                      );
                      offset += platform.share;
                      return element;
                    });
                  })()}
                  <text x="21" y="20" textAnchor="middle" className="donut-value">
                    {formatCompact(data.totals.reach)}
                  </text>
                  <text x="21" y="24.5" textAnchor="middle" className="donut-label">
                    total reach
                  </text>
                </svg>
              </div>
              <div className="platform-mix-list">
                {data.platforms.map((platform) => (
                  <div className="platform-mix-row" key={platform.platform}>
                    <PlatformIcon platform={platform.platform} badge size={12} />
                    <span>{PLATFORM_META[platform.platform].name}</span>
                    <strong>{formatPercent(platform.share)}</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="platform-mix-loading">
              <Skeleton style={{ width: 150, height: 150, borderRadius: 99 }} />
              <Skeleton style={{ width: '80%', height: 10 }} />
              <Skeleton style={{ width: '64%', height: 10 }} />
            </div>
          )}
        </section>
      </div>

      <div className="analytics-grid-2">
        <section className="card platform-performance-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Platform performance</h2>
              <p className="card-subtitle">Where your reach is coming from, and what it’s doing.</p>
            </div>
            <span className="pill">{data ? data.platforms.length : 5} channels</span>
          </div>
          {data ? (
            <div className="platform-table">
              <div className="platform-table-head">
                <span>Channel</span>
                <span>Followers</span>
                <span>Reach</span>
                <span>Eng. rate</span>
                <span>Posts</span>
              </div>
              {data.platforms.map((platform) => {
                const meta = PLATFORM_META[platform.platform];
                const maxReach = Math.max(...data.platforms.map((row) => row.reach), 1);
                return (
                  <div className="platform-table-row" key={platform.platform}>
                    <div className="platform-table-name">
                      <PlatformIcon platform={platform.platform} badge size={14} />
                      <span>
                        <strong>{meta.name}</strong>
                        <small>{meta.handleLabel}</small>
                      </span>
                    </div>
                    <span className="platform-table-followers">
                      {formatCompact(platform.followers)}
                      <small>{formatPercent(platform.followerChange, true)}</small>
                    </span>
                    <span className="platform-table-reach">
                      <strong>{formatCompact(platform.reach)}</strong>
                      <span className="platform-reach-track">
                        <span
                          style={{
                            width: `${Math.max((platform.reach / maxReach) * 100, 4)}%`,
                            background: meta.color,
                          }}
                        />
                      </span>
                    </span>
                    <span className="platform-table-rate">{formatPercent(platform.engagementRate)}</span>
                    <span className="platform-table-posts">{platform.posts}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="analytics-table-skeleton">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} style={{ height: 37 }} />
              ))}
            </div>
          )}
        </section>

        <section className="card audience-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Who’s listening</h2>
              <p className="card-subtitle">Audience mix across all five channels.</p>
            </div>
            <span className="pill pill-neutral">
              <Users size={10} /> {data ? formatCompact(data.totals.followers) : '—'}
            </span>
          </div>

          {data ? (
            <div className="audience-body">
              <div className="audience-section">
                <div className="audience-section-head">
                  <span>Age</span>
                  <small>share of audience</small>
                </div>
                {data.audience.age.map((slice) => (
                  <div className="audience-bar-row" key={slice.label}>
                    <span className="audience-bar-label">{slice.label}</span>
                    <span className="audience-bar-track">
                      <span style={{ width: `${slice.value}%` }} />
                    </span>
                    <span className="audience-bar-value">{slice.value}%</span>
                  </div>
                ))}
              </div>

              <div className="audience-section audience-gender">
                <div className="audience-section-head">
                  <span>Gender</span>
                </div>
                <div className="gender-stack" aria-hidden="true">
                  {data.audience.gender.map((slice, index) => (
                    <span
                      key={slice.label}
                      style={{
                        width: `${slice.value}%`,
                        background: ['#8fae83', '#d7b98d', '#cfc9e9'][index % 3],
                      }}
                    />
                  ))}
                </div>
                <div className="gender-legend">
                  {data.audience.gender.map((slice, index) => (
                    <span key={slice.label}>
                      <i style={{ background: ['#8fae83', '#d7b98d', '#cfc9e9'][index % 3] }} />
                      {slice.label} {slice.value}%
                    </span>
                  ))}
                </div>
              </div>

              <div className="audience-section">
                <div className="audience-section-head">
                  <span>Top locations</span>
                  <small>
                    <MapPin size={9} /> where they are
                  </small>
                </div>
                <div className="location-list">
                  {data.audience.locations.map((slice) => (
                    <div className="location-row" key={slice.label}>
                      <span>{slice.label}</span>
                      <span className="location-track">
                        <span style={{ width: `${slice.value * 2.6}%` }} />
                      </span>
                      <strong>{slice.value}%</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="audience-section audience-hours">
                <div className="audience-section-head">
                  <span>Active hours</span>
                  <small>
                    <Clock3 size={9} /> your local time
                  </small>
                </div>
                <div className="hours-chart">
                  {data.audience.activeHours.map((value, hour) => (
                    <span
                      key={hour}
                      className={value >= 85 ? 'is-peak' : ''}
                      style={{ height: `${Math.max(value, 6)}%` }}
                      title={`${hour}:00 · ${value}% active`}
                    />
                  ))}
                </div>
                <div className="hours-axis">
                  <span>12am</span>
                  <span>6am</span>
                  <span>12pm</span>
                  <span>6pm</span>
                  <span>11pm</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="audience-loading">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} style={{ height: 12 }} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card heatmap-card">
        <div className="card-header">
          <div>
            <h2 className="card-title">When your audience shows up</h2>
            <p className="card-subtitle">
              Engagement intensity by day and time. Darker means more attention.
            </p>
          </div>
          <div className="heatmap-legend">
            <span>Quiet</span>
            <i className="heatmap-gradient" />
            <span>Peak</span>
          </div>
        </div>

        {data ? (
          <div className="heatmap-layout">
            <div className="heatmap-grid-wrap">
              <div className="heatmap-grid">
                <span />
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <span className="heatmap-day" key={day}>{day}</span>
                ))}
                {['6–9am', '9–12pm', '12–3pm', '3–6pm', '6–9pm', '9–12am'].map((slot) => (
                  <div className="heatmap-row" key={slot}>
                    <span className="heatmap-slot">{slot}</span>
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => {
                      const cell = data.heatmap.find(
                        (item) => item.day === day && item.slot === slot,
                      );
                      const value = cell?.value ?? 0;
                      return (
                        <span
                          key={`${day}-${slot}`}
                          className="heatmap-cell"
                          style={{
                            background: `rgba(30, 63, 45, ${0.07 + (value / 100) * 0.8})`,
                            color: value > 56 ? '#f4f8f1' : '#5d6a5f',
                          }}
                          title={`${day} ${slot} · ${value}% intensity`}
                        >
                          {value}
                        </span>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <aside className="heatmap-insight">
              <span className="heatmap-insight-icon">
                <CalendarClock size={18} />
              </span>
              <p className="heatmap-insight-eyebrow">Your strongest window</p>
              <h3>
                {data.bestDay}, <em>{data.bestHour}</em>
              </h3>
              <p>
                That’s when your audience is most likely to stop, read and reply. Put launch posts
                and bigger swings here.
              </p>
              <div className="heatmap-insight-stats">
                <span>
                  <strong>{data.bestDay}</strong>
                  best day
                </span>
                <span>
                  <strong>{data.bestHour}</strong>
                  best time
                </span>
              </div>
              <Link href="/composer" className="btn btn-sm btn-accent">
                Plan a post <ArrowRight size={12} />
              </Link>
            </aside>
          </div>
        ) : (
          <div className="heatmap-loading">
            <Skeleton style={{ height: 230 }} />
          </div>
        )}
      </section>

      <div className="analytics-grid-2 analytics-lower">
        <section className="card top-posts-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Top performing posts</h2>
              <p className="card-subtitle">The content carrying your reach this period.</p>
            </div>
            <Link href="/content" className="text-link">
              Content library <ArrowRight size={12} />
            </Link>
          </div>
          <div className="analytics-post-list">
            {data
              ? data.topPosts.map((post, index) => {
                  const engagement =
                    post.metrics.likes +
                    post.metrics.comments +
                    post.metrics.shares +
                    post.metrics.saves;
                  const maxImpressions = Math.max(
                    ...data.topPosts.map((item) => item.metrics.impressions),
                    1,
                  );
                  return (
                    <Link
                      href={`/content?focus=${post.id}`}
                      className="analytics-post-row"
                      key={post.id}
                    >
                      <span className="analytics-post-rank">{String(index + 1).padStart(2, '0')}</span>
                      <MediaThumb media={post.media[0]} size={42} rounded={9} />
                      <span className="analytics-post-copy">
                        <strong>{post.title || post.caption.split('\n')[0]}</strong>
                        <span className="analytics-post-meta">
                          <PlatformStack platforms={post.platforms} size={9} />
                          <span>{formatCompact(post.metrics.impressions)} views</span>
                          <span>
                            <Heart size={9} /> {formatCompact(engagement)}
                          </span>
                        </span>
                        <span className="analytics-post-track">
                          <span
                            style={{
                              width: `${Math.max((post.metrics.impressions / maxImpressions) * 100, 3)}%`,
                            }}
                          />
                        </span>
                      </span>
                      <StatusBadge status={post.status} />
                    </Link>
                  );
                })
              : Array.from({ length: 4 }).map((_, index) => (
                  <div className="analytics-post-row" key={index}>
                    <Skeleton style={{ width: 42, height: 42, borderRadius: 9 }} />
                    <Skeleton style={{ flex: 1, height: 11 }} />
                  </div>
                ))}
          </div>
        </section>

        <section className="card formats-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">What works by format</h2>
              <p className="card-subtitle">Reach and engagement by content type.</p>
            </div>
            <span className="pill pill-accent">
              <Sparkles size={10} /> Insight
            </span>
          </div>
          {data ? (
            <div className="format-list">
              {data.formats.map((format) => {
                const maxReach = Math.max(...data.formats.map((item) => item.reach), 1);
                const icon =
                  format.label === 'Video' ? (
                    <Eye size={13} />
                  ) : format.label === 'Carousel' ? (
                    <FileText size={13} />
                  ) : (
                    <Heart size={13} />
                  );
                return (
                  <div className="format-row" key={format.label}>
                    <span className="format-icon">{icon}</span>
                    <div className="format-copy">
                      <div className="format-title-row">
                        <strong>{format.label}</strong>
                        <span>{format.posts} posts</span>
                      </div>
                      <span className="format-track">
                        <span
                          style={{
                            width: `${Math.max((format.reach / maxReach) * 100, 4)}%`,
                          }}
                        />
                      </span>
                    </div>
                    <div className="format-stats">
                      <strong>{formatCompact(format.reach)}</strong>
                      <span>{formatPercent(format.engagementRate)} ER</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="format-loading">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} style={{ height: 38 }} />
              ))}
            </div>
          )}
          <div className="format-note">
            <Sparkles size={12} />
            <p>
              {data?.formats[0]
                ? `${data.formats[0].label} is your strongest format in this window. Reuse the structure that worked, not just the topic.`
                : 'Publish a few more posts to unlock format insights.'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}

function AnalyticsMetric({
  label,
  icon,
  value,
  change,
  period,
  spark,
  sparkColor,
  loading,
  dark = false,
  sage = false,
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
  sage?: boolean;
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <div
      className={`metric-card ${dark ? 'metric-card-dark' : ''} ${sage ? 'metric-card-queue' : ''}`}
    >
      <div className="metric-top">
        <span className="metric-label">{label}</span>
        <span className={`metric-icon ${dark ? 'metric-icon-dark' : ''} ${sage ? 'metric-icon-sage' : ''}`}>
          {icon}
        </span>
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
          <span className="metric-mini-label">
            <TrendingUp size={10} /> {sage ? 'This period' : 'Average'}
          </span>
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
