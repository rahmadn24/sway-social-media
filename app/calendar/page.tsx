'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Account, Post } from '@/lib/types';
import { PLATFORM_META } from '@/lib/platforms';
import { accountsSummary } from '@/lib/accounts';
import { apiRequest, refreshWorkspaceCounts } from '@/lib/client';
import { useToast } from '@/components/ToastProvider';
import {
  addDays,
  addMonths,
  formatMonthYear,
  formatRelative,
  formatScheduled,
  formatShortDate,
  startOfMonth,
} from '@/lib/format';
import { MediaThumb } from '@/components/MediaThumb';
import {
  LiveDot,
  Modal,
  PageHeader,
  PlatformIcon,
  PlatformStack,
  Skeleton,
  StatusBadge,
} from '@/components/ui';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function postDate(post: Post): Date | null {
  const value = post.status === 'published' ? post.publishedAt : post.scheduledAt;
  return value ? new Date(value) : null;
}

function postAccounts(post: Post, accounts: Account[]): string {
  return accountsSummary(accounts, post.accountIds);
}

/** Local value for <input type="datetime-local">, defaulting to the next hour. */
function defaultScheduleValue(): string {
  const date = new Date(Date.now() + 60 * 60 * 1000);
  date.setMinutes(0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CalendarPage() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Post | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<Post | null>(null);
  const [scheduleValue, setScheduleValue] = useState('');
  const [scheduleError, setScheduleError] = useState('');
  const [scheduling, setScheduling] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    Promise.allSettled([
      apiRequest<{ posts: Post[] }>('/api/posts?sort=updated').then((data) => setPosts(data.posts)),
      apiRequest<{ accounts: Account[] }>('/api/connections').then((data) =>
        setAccounts(data.accounts),
      ),
    ]).finally(() => setLoading(false));
  }, []);

  const scheduled = posts.filter((post) => post.status === 'scheduled');
  const drafts = posts.filter((post) => post.status === 'draft');

  function openSchedule(post: Post) {
    setScheduleTarget(post);
    setScheduleValue(defaultScheduleValue());
    setScheduleError('');
  }

  async function confirmSchedule() {
    if (!scheduleTarget) return;
    if (!scheduleValue) {
      setScheduleError('Choose a date and time.');
      return;
    }
    const at = new Date(scheduleValue);
    if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() - 60_000) {
      setScheduleError('Pick a time in the future.');
      return;
    }
    setScheduling(true);
    setScheduleError('');
    try {
      const data = await apiRequest<{ post: Post }>(`/api/posts/${scheduleTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'scheduled',
          scheduledAt: at.toISOString(),
          autoPublish: true,
        }),
      });
      setPosts((current) =>
        current.map((post) => (post.id === data.post.id ? data.post : post)),
      );
      setScheduleTarget(null);
      refreshWorkspaceCounts();
      toast(`“${data.post.title || data.post.caption.slice(0, 40)}” is queued for ${formatScheduled(data.post.scheduledAt)}.`);
    } catch (reason) {
      setScheduleError(reason instanceof Error ? reason.message : 'Could not schedule this post.');
    } finally {
      setScheduling(false);
    }
  }
  const upNext = [...scheduled]
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''))
    .slice(0, 5);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    posts.forEach((post) => {
      const date = postDate(post);
      if (!date) return;
      const key = dayKey(date);
      const current = map.get(key) ?? [];
      current.push(post);
      map.set(key, current);
    });
    return map;
  }, [posts]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const startOffset = (first.getDay() + 6) % 7;
    const start = addDays(first, -startOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(start, index);
      const key = dayKey(date);
      return {
        date,
        key,
        currentMonth: date.getMonth() === month.getMonth(),
        isToday: key === dayKey(new Date()),
        posts: (eventsByDay.get(key) ?? []).sort((a, b) => {
          const first = a.scheduledAt ?? a.publishedAt ?? '';
          const second = b.scheduledAt ?? b.publishedAt ?? '';
          return first.localeCompare(second);
        }),
      };
    });
  }, [month, eventsByDay]);

  const monthScheduled = scheduled.filter((post) => {
    if (!post.scheduledAt) return false;
    const date = new Date(post.scheduledAt);
    return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
  }).length;

  return (
    <div className="calendar-page">
      <PageHeader
        eyebrow={
          <>
            Calendar
            <span className="eyebrow-dot" />
            {monthScheduled} scheduled this month
          </>
        }
        title={
          <>
            A calmer content <em>rhythm</em>.
          </>
        }
        subtitle="See the whole month at a glance. Everything queued, published and still waiting for a date."
        actions={
          <>
            <Link href="/studio" className="btn btn-secondary">
              <Sparkles size={15} /> Idea session
            </Link>
            <Link href="/composer" className="btn btn-accent">
              <Plus size={15} /> New post
            </Link>
          </>
        }
      />

      <div className="calendar-layout">
        <section className="card calendar-card">
          <div className="calendar-toolbar">
            <div className="calendar-month">
              <h2>{formatMonthYear(month)}</h2>
              <span>{monthScheduled} planned</span>
            </div>
            <div className="calendar-controls">
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setMonth(startOfMonth(new Date()))}
              >
                Today
              </button>
              <div className="calendar-nav">
                <button
                  className="icon-button icon-button-small"
                  onClick={() => setMonth((current) => addMonths(current, -1))}
                  aria-label="Previous month"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  className="icon-button icon-button-small"
                  onClick={() => setMonth((current) => addMonths(current, 1))}
                  aria-label="Next month"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="calendar-grid-scroll">
            <div className="calendar-inner">
              <div className="calendar-weekdays">
                {WEEKDAYS.map((day) => (
                  <span key={day}>{day}</span>
                ))}
              </div>
              <div className="calendar-grid">
                {days.map((day) => (
                  <div
                    key={day.key}
                    className={`calendar-day ${day.currentMonth ? '' : 'calendar-day-outside'} ${day.isToday ? 'calendar-day-today' : ''}`}
                  >
                    <div className="calendar-day-head">
                      <span className="calendar-day-number">{day.date.getDate()}</span>
                      <Link
                        href={`/composer?date=${day.key}`}
                        className="calendar-day-add"
                        aria-label={`Create a post on ${formatShortDate(day.date.toISOString())}`}
                      >
                        <Plus size={11} />
                      </Link>
                    </div>
                    <div className="calendar-day-events">
                      {day.posts.slice(0, 3).map((post) => {
                        const date = postDate(post);
                        const accountLabel = postAccounts(post, accounts);
                        return (
                          <button
                            key={post.id}
                            className={`calendar-event calendar-event-${post.status}`}
                            style={{ borderLeftColor: PLATFORM_META[post.platforms[0]]?.color ?? '#9ca89e' }}
                            onClick={() => setSelected(post)}
                            title={`${post.title || post.caption.slice(0, 70)} · ${accountLabel}`}
                          >
                            <span className="calendar-event-platform">
                              {post.platforms[0] && <PlatformIcon platform={post.platforms[0]} size={8} />}
                            </span>
                            <span className="calendar-event-copy">
                              <span>{post.title || post.caption.split('\n')[0]}</span>
                              <small>{accountLabel}</small>
                            </span>
                            {date && (
                              <time>
                                {date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                              </time>
                            )}
                          </button>
                        );
                      })}
                      {day.posts.length > 3 && (
                        <button className="calendar-more" onClick={() => setSelected(day.posts[3])}>
                          +{day.posts.length - 3} more
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="calendar-legend">
            <span><i className="calendar-key key-scheduled" /> Scheduled</span>
            <span><i className="calendar-key key-published" /> Published</span>
            <span><i className="calendar-key key-draft" /> Draft</span>
            <span className="calendar-legend-hint">
              <Clock3 size={11} /> Times in your local timezone
            </span>
          </div>
        </section>

        <aside className="calendar-side">
          <section className="card calendar-side-card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Next up</h2>
                <p className="card-subtitle">The next five in your queue.</p>
              </div>
              <span className="pill pill-accent">
                <LiveDot /> {scheduled.length}
              </span>
            </div>
            <div className="agenda-list">
              {loading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <div className="agenda-item" key={index}>
                      <Skeleton style={{ width: 40, height: 40, borderRadius: 9 }} />
                      <div>
                        <Skeleton style={{ width: 140, height: 10 }} />
                        <Skeleton style={{ width: 100, height: 8, marginTop: 7 }} />
                      </div>
                    </div>
                  ))
                : upNext.map((post) => (
                    <Link href={`/composer?edit=${post.id}`} key={post.id} className="agenda-item">
                      <MediaThumb media={post.media[0]} size={40} rounded={9} />
                      <div>
                        <strong>{post.title || post.caption.split('\n')[0]}</strong>
                        <span>{formatScheduled(post.scheduledAt)}</span>
                        <span className="agenda-account">{postAccounts(post, accounts)}</span>
                        <PlatformStack platforms={post.platforms} size={9} />
                      </div>
                      <ArrowRight size={13} />
                    </Link>
                  ))}
              {!loading && upNext.length === 0 && (
                <div className="calendar-empty-mini">
                  <CalendarDays size={18} />
                  <p>Nothing scheduled. Your calendar is wide open.</p>
                </div>
              )}
            </div>
            <Link href="/composer" className="agenda-add">
              <Plus size={13} /> Add to the queue
            </Link>
          </section>

          <section className="card calendar-side-card drafts-side-card">
            <div className="card-header">
              <div>
                <h2 className="card-title">Waiting for a date</h2>
                <p className="card-subtitle">{drafts.length} drafts without a schedule.</p>
              </div>
            </div>
            <div className="draft-queue">
              {drafts.slice(0, 4).map((post) => (
                <div className="draft-queue-item draft-queue-item-row" key={post.id}>
                  <Link href={`/composer?edit=${post.id}`} className="draft-queue-link">
                    <span className="draft-queue-icon">
                      <FileText size={14} />
                    </span>
                    <span>
                      <strong>{post.title || post.caption.split('\n')[0]}</strong>
                      <small>Edited {formatRelative(post.updatedAt)}</small>
                    </span>
                    <ArrowRight size={12} />
                  </Link>
                  <button
                    className="icon-button icon-button-small draft-queue-schedule"
                    onClick={() => openSchedule(post)}
                    aria-label={`Schedule ${post.title || 'draft'}`}
                    title="Give it a publishing slot"
                  >
                    <Clock3 size={13} />
                  </button>
                </div>
              ))}
              {drafts.length === 0 && <p className="calendar-empty-copy">Every idea has a home. Nice.</p>}
            </div>
            {drafts.length > 0 && (
              <Link href="/content?status=draft" className="text-link drafts-link">
                Review all drafts <ChevronRight size={12} />
              </Link>
            )}
          </section>

          <div className="calendar-quote">
            <Sparkles size={16} />
            <p>“Consistency isn’t posting every day. It’s coming back to the conversation.”</p>
            <span>Sway note · for Maya</span>
          </div>
        </aside>
      </div>

      {selected && (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={selected.title || 'Calendar post'}
          description={formatScheduled(selected.scheduledAt ?? selected.publishedAt)}
          size="md"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>
                Close
              </button>
              {selected.status !== 'published' ? (
                <Link href={`/composer?edit=${selected.id}`} className="btn btn-primary">
                  Edit post <ArrowRight size={13} />
                </Link>
              ) : (
                <Link href={`/content?focus=${selected.id}`} className="btn btn-primary">
                  View post <ArrowRight size={13} />
                </Link>
              )}
            </>
          }
        >
          <div className="calendar-modal">
            <div className="calendar-modal-media">
              <MediaThumb media={selected.media[0]} size={160} rounded={14} />
              <div>
                <div className="calendar-modal-badges">
                  <StatusBadge status={selected.status} />
                  <PlatformStack platforms={selected.platforms} size={11} />
                </div>
                <p>{selected.caption}</p>
                <div className="calendar-modal-accounts">
                  {selected.accountIds
                    .map((id) => accounts.find((account) => account.id === id))
                    .filter((account): account is Account => Boolean(account))
                    .map((account) => (
                      <span className="account-chip" key={account.id}>
                        <PlatformIcon platform={account.platform} size={10} />
                        {account.displayName}
                      </span>
                    ))}
                </div>
                <div className="calendar-modal-meta">
                  <span>
                    <CalendarDays size={12} />
                    {formatShortDate(selected.scheduledAt ?? selected.publishedAt)}
                  </span>
                  {selected.autoPublish && selected.status === 'scheduled' && (
                    <span><LiveDot /> Auto-publish on</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {scheduleTarget && (
        <Modal
          open
          onClose={() => setScheduleTarget(null)}
          title="Give this draft a slot"
          description={scheduleTarget.title || scheduleTarget.caption.split('\n')[0]}
          size="sm"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setScheduleTarget(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void confirmSchedule()}
                disabled={scheduling}
              >
                {scheduling ? 'Scheduling…' : 'Schedule post'}
              </button>
            </>
          }
        >
          <div className="schedule-panel">
            <div className="field">
              <label className="label" htmlFor="schedule-at">
                Publish at
              </label>
              <input
                id="schedule-at"
                className="input"
                type="datetime-local"
                value={scheduleValue}
                onChange={(event) => {
                  setScheduleValue(event.target.value);
                  setScheduleError('');
                }}
              />
            </div>
            <p className="hint">
              Sway will publish automatically at this time — auto-publish is switched on for you.
            </p>
            {scheduleError && <p className="error-text">{scheduleError}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
