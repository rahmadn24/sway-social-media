'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Copy,
  Eye,
  FileText,
  Filter,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import type { Account, MediaAsset, Platform, Post, PostStatus } from '@/lib/types';
import { PLATFORM_LIST, PLATFORM_META } from '@/lib/platforms';
import { apiRequest, refreshNotifications, refreshWorkspaceCounts } from '@/lib/client';
import {
  formatCompact,
  formatRelative,
  formatScheduled,
  formatShortDate,
  platformSummary,
} from '@/lib/format';
import { MediaThumb } from '@/components/MediaThumb';
import {
  Avatar,
  EmptyState,
  LiveDot,
  Modal,
  PageHeader,
  PlatformIcon,
  PlatformStack,
  Skeleton,
  Spinner,
  StatusBadge,
} from '@/components/ui';
import { useToast } from '@/components/ToastProvider';

type StatusFilter = 'all' | PostStatus;

interface PostsResponse {
  posts: Post[];
  counts: Record<'all' | PostStatus, number>;
  total: number;
}

const TABS: Array<{ id: StatusFilter; label: string }> = [
  { id: 'all', label: 'All content' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'draft', label: 'Drafts' },
  { id: 'published', label: 'Published' },
];

function postAccountSummary(post: Post, accounts: Account[]): string {
  const selected = post.accountIds
    .map((id) => accounts.find((account) => account.id === id))
    .filter((account): account is Account => Boolean(account));
  if (selected.length === 0) return platformSummary(post.platforms);
  if (selected.length <= 2) return selected.map((account) => account.displayName).join(' · ');
  return `${selected[0].displayName} +${selected.length - 1} more`;
}

export default function ContentPage() {
  return (
    <Suspense fallback={<ContentFallback />}>
      <ContentInner />
    </Suspense>
  );
}

function ContentFallback() {
  return (
    <div>
      <PageHeader eyebrow="Content library" title="Everything you’ve made." subtitle="Loading your library…" />
      <div className="card library-card">
        <div className="library-loading">
          <Skeleton style={{ width: '100%', height: 60 }} />
          <Skeleton style={{ width: '100%', height: 60 }} />
          <Skeleton style={{ width: '100%', height: 60 }} />
        </div>
      </div>
    </div>
  );
}

function ContentInner() {
  const searchParams = useSearchParams();
  const focusId = searchParams.get('focus');
  const { toast } = useToast();

  const [status, setStatus] = useState<StatusFilter>('all');
  const [platform, setPlatform] = useState<'all' | Platform>('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState('');
  const [data, setData] = useState<PostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewPost, setPreviewPost] = useState<Post | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Post | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusHandled = useRef(false);

  useEffect(() => {
    apiRequest<{ accounts: Account[] }>('/api/connections')
      .then((result) => setAccounts(result.accounts))
      .catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status !== 'all') params.set('status', status);
      if (platform !== 'all') params.set('platform', platform);
      if (accountFilter !== 'all') params.set('accountId', accountFilter);
      if (query.trim()) params.set('q', query.trim());
      const result = await apiRequest<PostsResponse>(`/api/posts?${params.toString()}`);
      setData(result);
      return result;
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : 'Could not load your content.', 'error');
      return null;
    } finally {
      setLoading(false);
    }
  }, [status, platform, accountFilter, query, toast]);

  useEffect(() => {
    if (accountFilter === 'all') return;
    const account = accounts.find((candidate) => candidate.id === accountFilter);
    if (!account) return;
    if (platform !== 'all' && account.platform !== platform) setAccountFilter('all');
  }, [platform, accountFilter, accounts]);

  const accountOptions =
    platform === 'all' ? accounts : accounts.filter((account) => account.platform === platform);
  const filtersActive =
    query.trim().length > 0 || platform !== 'all' || accountFilter !== 'all' || status !== 'all';

  useEffect(() => {
    const timeout = window.setTimeout(() => void load(), 180);
    return () => window.clearTimeout(timeout);
  }, [load]);

  useEffect(() => {
    if (!focusId || focusHandled.current || !data) return;
    const post = data.posts.find((candidate) => candidate.id === focusId);
    if (post) {
      setPreviewPost(post);
      focusHandled.current = true;
    }
  }, [focusId, data]);

  useEffect(() => {
    if (!openMenu) return;
    const close = (event: MouseEvent) => {
      if ((event.target as Element).closest('[data-post-menu]')) return;
      setOpenMenu(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [openMenu]);

  async function runAction(post: Post, action: 'publish' | 'duplicate' | 'delete') {
    setWorking(post.id);
    setOpenMenu(null);
    try {
      if (action === 'publish') {
        const result = await apiRequest<{ post: Post }>(`/api/posts/${post.id}/publish`, {
          method: 'POST',
        });
        toast(`Published “${result.post.title}”.`);
        setPreviewPost(null);
      } else if (action === 'duplicate') {
        await apiRequest(`/api/posts/${post.id}/duplicate`, { method: 'POST' });
        toast('Duplicated as a new draft.');
      } else {
        await apiRequest(`/api/posts/${post.id}`, { method: 'DELETE' });
        toast('Post deleted.');
        setPreviewPost(null);
        setDeleteTarget(null);
      }
      refreshWorkspaceCounts();
      refreshNotifications();
      await load();
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : 'That action could not be completed.', 'error');
      await load();
    } finally {
      setWorking(null);
    }
  }

  const counts = data?.counts ?? { all: 0, draft: 0, scheduled: 0, published: 0, failed: 0 };
  const posts = data?.posts ?? [];
  const nextScheduled = posts.find((post) => post.status === 'scheduled');

  return (
    <div className="content-page">
      <PageHeader
        eyebrow={
          <>
            Content library
            <span className="eyebrow-dot" />
            <span suppressHydrationWarning>{formatShortDate(new Date().toISOString())}</span>
          </>
        }
        title={
          <>
            Everything you’ve made, <em>in one place</em>.
          </>
        }
        subtitle="From half-formed ideas to live posts. Pick up where you left off, or send something out into the world."
        actions={
          <Link href="/composer" className="btn btn-primary">
            <Plus size={15} />
            Create post
          </Link>
        }
      />

      <div className="library-toolbar">
        <div className="library-tabs" role="tablist" aria-label="Filter by status">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={status === tab.id}
              className={status === tab.id ? 'is-active' : ''}
              onClick={() => setStatus(tab.id)}
            >
              {tab.label}
              <span>{counts[tab.id] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="library-tools">
          <label className="library-search">
            <Search size={14} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search content…"
              aria-label="Search content"
            />
            {query && (
              <button onClick={() => setQuery('')} aria-label="Clear search" type="button">
                <X size={12} />
              </button>
            )}
          </label>
          <div className="select-wrap library-filter">
            <Filter size={13} />
            <select
              value={platform}
              onChange={(event) => {
                setPlatform(event.target.value as 'all' | Platform);
                setAccountFilter('all');
              }}
              aria-label="Filter by platform"
            >
              <option value="all">All platforms</option>
              {PLATFORM_LIST.map((meta) => (
                <option value={meta.id} key={meta.id}>
                  {meta.name}
                </option>
              ))}
            </select>
            <ChevronDown size={13} />
          </div>
          <div className="select-wrap library-filter">
            <Avatar name="Account" size={14} />
            <select
              value={accountFilter}
              onChange={(event) => setAccountFilter(event.target.value)}
              aria-label="Filter by account"
            >
              <option value="all">All accounts</option>
              {accountOptions.map((account) => (
                <option value={account.id} key={account.id}>
                  {account.displayName} · {account.handle}
                </option>
              ))}
            </select>
            <ChevronDown size={13} />
          </div>
        </div>
      </div>

      <div className="content-summary-strip">
        <div>
          <span className="summary-icon summary-icon-sage">
            <CalendarClock size={14} />
          </span>
          <span>
            <strong>{counts.scheduled}</strong> scheduled
          </span>
          {nextScheduled?.scheduledAt && (
            <span className="summary-muted">next {formatRelative(nextScheduled.scheduledAt)}</span>
          )}
        </div>
        <div>
          <span className="summary-icon summary-icon-pink">
            <FileText size={14} />
          </span>
          <span>
            <strong>{counts.draft}</strong> drafts
          </span>
        </div>
        <div>
          <span className="summary-icon summary-icon-blue">
            <Send size={14} />
          </span>
          <span>
            <strong>{counts.published}</strong> published
          </span>
        </div>
        <span className="summary-auto">
          <LiveDot /> Auto-publish is on
        </span>
      </div>

      <section className="card library-card">
        <div className="library-table-head">
          <span>Post</span>
          <span>Channels</span>
          <span>Status</span>
          <span>Publish date</span>
          <span>Performance</span>
          <span />
        </div>

        <div className="library-list">
          {loading && !data
            ? Array.from({ length: 5 }).map((_, index) => (
                <div className="library-row library-row-loading" key={index}>
                  <div className="library-post-cell">
                    <Skeleton style={{ width: 52, height: 52, borderRadius: 12 }} />
                    <div>
                      <Skeleton style={{ width: '55%', height: 11 }} />
                      <Skeleton style={{ width: '78%', height: 9, marginTop: 8 }} />
                    </div>
                  </div>
                  <Skeleton style={{ width: 60, height: 22 }} />
                  <Skeleton style={{ width: 62, height: 22 }} />
                  <Skeleton style={{ width: 72, height: 10 }} />
                  <Skeleton style={{ width: 56, height: 10 }} />
                </div>
              ))
            : posts.map((post) => (
                <article
                  key={post.id}
                  className={`library-row ${previewPost?.id === post.id ? 'library-row-active' : ''}`}
                >
                  <button className="library-post-cell" onClick={() => setPreviewPost(post)}>
                    <span className="library-media-wrap">
                      <MediaThumb media={post.media[0]} size={52} rounded={12} />
                      {post.media.length > 1 && (
                        <span className="library-media-count">+{post.media.length - 1}</span>
                      )}
                    </span>
                    <span className="library-post-copy">
                      <strong>{post.title || post.caption.split('\n')[0] || 'Untitled post'}</strong>
                      <span>{post.caption.replace(/\n/g, ' ').slice(0, 92) || 'Media-only post'}</span>
                      <span className="library-post-tags">
                        {post.aiGenerated && (
                          <span className="mini-ai-tag">
                            <Sparkles size={8} /> AI-assisted
                          </span>
                        )}
                        {post.tags.slice(0, 2).map((tag) => (
                          <span className="tag" key={tag}>{tag}</span>
                        ))}
                      </span>
                    </span>
                  </button>

                  <div className="library-channels">
                    <PlatformStack platforms={post.platforms} size={12} />
                    <span>{postAccountSummary(post, accounts)}</span>
                  </div>

                  <div>
                    <StatusBadge status={post.status} />
                    {post.status === 'scheduled' && post.autoPublish && (
                      <span className="row-auto"><LiveDot /> Auto</span>
                    )}
                  </div>

                  <div className="library-date">
                    {post.status === 'published' ? (
                      <>
                        <strong>{formatShortDate(post.publishedAt)}</strong>
                        <span>{post.publishedAt ? formatRelative(post.publishedAt) : ''}</span>
                      </>
                    ) : post.status === 'scheduled' ? (
                      <>
                        <strong>{formatScheduled(post.scheduledAt)}</strong>
                        <span>{formatRelative(post.scheduledAt ?? new Date())}</span>
                      </>
                    ) : (
                      <>
                        <strong>{post.status === 'failed' ? 'Publish failed' : 'Not scheduled'}</strong>
                        <span>Edited {formatRelative(post.updatedAt)}</span>
                      </>
                    )}
                  </div>

                  <div className="library-performance">
                    {post.status === 'published' ? (
                      <>
                        <strong>
                          <Eye size={11} />
                          {formatCompact(post.metrics.impressions)}
                        </strong>
                        <span>
                          <Heart size={10} />
                          {formatCompact(post.metrics.likes + post.metrics.comments + post.metrics.saves)}
                        </span>
                      </>
                    ) : (
                      <span className="library-performance-empty">—</span>
                    )}
                  </div>

                  <div className="row-actions" data-post-menu>
                    <button
                      className="icon-button icon-button-small"
                      aria-label={`Actions for ${post.title}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenMenu((current) => (current === post.id ? null : post.id));
                      }}
                      disabled={working === post.id}
                    >
                      {working === post.id ? <Spinner size={14} /> : <MoreHorizontal size={16} />}
                    </button>
                    {openMenu === post.id && (
                      <div className="row-menu">
                        <button onClick={() => setPreviewPost(post)}>
                          <Eye size={14} /> Preview
                        </button>
                        {post.status !== 'published' && (
                          <Link href={`/composer?edit=${post.id}`}>
                            <Pencil size={14} /> Edit post
                          </Link>
                        )}
                        {post.status !== 'published' && (
                          <button onClick={() => void runAction(post, 'publish')}>
                            <Send size={14} /> Publish now
                          </button>
                        )}
                        <button onClick={() => void runAction(post, 'duplicate')}>
                          <Copy size={14} /> Duplicate
                        </button>
                        <div className="row-menu-divider" />
                        <button className="row-menu-danger" onClick={() => setDeleteTarget(post)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
          {!loading && data && posts.length === 0 && (
            <EmptyState
              icon={<FileText size={21} />}
              title="Nothing here yet"
              description={
                query || platform !== 'all' || accountFilter !== 'all' || status !== 'all'
                  ? 'No posts match these filters. Try clearing one of them.'
                  : 'Your next great idea starts with a blank page. Create your first post and it will live here.'
              }
              action={
                filtersActive ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setQuery('');
                      setPlatform('all');
                      setAccountFilter('all');
                      setStatus('all');
                    }}
                  >
                    Clear filters
                  </button>
                ) : (
                  <Link href="/composer" className="btn btn-accent btn-sm">
                    <Plus size={13} /> Create first post
                  </Link>
                )
              }
            />
          )}
        </div>

        {posts.length > 0 && (
          <footer className="library-footer">
            <span>
              Showing {posts.length} {posts.length === 1 ? 'post' : 'posts'}
              {query ? ` for “${query}”` : ''}
            </span>
            <span className="library-footer-hint">
              <Clock3 size={11} />
              All times shown in your local timezone
            </span>
          </footer>
        )}
      </section>

      {previewPost && (
        <Modal
          open
          onClose={() => setPreviewPost(null)}
          title={previewPost.title || 'Post preview'}
          description={`${postAccountSummary(previewPost, accounts)} · ${
            previewPost.platforms.map((item) => PLATFORM_META[item].name).join(' · ')
          }`}
          size="lg"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setPreviewPost(null)}>
                Close
              </button>
              {previewPost.status !== 'published' && (
                <>
                  <button
                    className="btn btn-secondary"
                    onClick={() => void runAction(previewPost, 'duplicate')}
                  >
                    <Copy size={14} /> Duplicate
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => void runAction(previewPost, 'publish')}
                    disabled={working === previewPost.id}
                  >
                    {working === previewPost.id ? <Spinner size={14} /> : <Send size={14} />}
                    Publish now
                  </button>
                </>
              )}
            </>
          }
        >
          <PostDetail post={previewPost} accounts={accounts} />
        </Modal>
      )}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this post?"
        description="This removes it from Sway. This can’t be undone."
        size="sm"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>
              Keep post
            </button>
            <button
              className="btn btn-danger"
              onClick={() => deleteTarget && void runAction(deleteTarget, 'delete')}
              disabled={working === deleteTarget?.id}
            >
              {working === deleteTarget?.id ? <Spinner size={14} /> : <Trash2 size={14} />}
              Delete post
            </button>
          </>
        }
      >
        <div className="delete-preview">
          <MediaThumb media={deleteTarget?.media[0]} size={54} rounded={12} />
          <div>
            <strong>{deleteTarget?.title || 'Untitled post'}</strong>
            <p>{deleteTarget?.caption.replace(/\n/g, ' ').slice(0, 120)}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function PostDetail({ post, accounts }: { post: Post; accounts: Account[] }) {
  const [activeMedia, setActiveMedia] = useState(0);
  const media: MediaAsset | undefined = post.media[activeMedia];
  const selectedAccounts = post.accountIds
    .map((id) => accounts.find((account) => account.id === id))
    .filter((account): account is Account => Boolean(account));
  const engagement =
    post.metrics.likes + post.metrics.comments + post.metrics.shares + post.metrics.saves;

  return (
    <div className="post-detail">
      <div className="post-detail-media">
        {media ? (
          media.type === 'video' ? (
            <video src={media.url} controls muted />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={media.url} alt={media.alt ?? post.title ?? ''} />
          )
        ) : (
          <div className="post-detail-no-media">
            <FileText size={26} />
            <span>Text-only post</span>
          </div>
        )}
        {post.media.length > 1 && (
          <div className="post-detail-thumbs">
            {post.media.map((item, index) => (
              <button
                key={item.id}
                className={index === activeMedia ? 'is-active' : ''}
                onClick={() => setActiveMedia(index)}
                aria-label={`View media ${index + 1}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" />
                {item.type === 'video' && <Play size={9} fill="currentColor" />}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="post-detail-body">
        <div className="post-detail-badges">
          {post.platforms.map((item) => (
            <span className="post-detail-platform" key={item}>
              <PlatformIcon platform={item} size={11} />
              {PLATFORM_META[item].name}
            </span>
          ))}
          {selectedAccounts.map((account) => (
            <span className="post-detail-account" key={account.id}>
              <Avatar name={account.displayName} src="/avatars/maya.jpg" size={16} />
              {account.handle}
            </span>
          ))}
        </div>
        <div className="post-detail-status">
          <StatusBadge status={post.status} />
          <span>
            {post.status === 'published'
              ? formatShortDate(post.publishedAt)
              : post.status === 'scheduled'
                ? formatScheduled(post.scheduledAt)
                : `Edited ${formatRelative(post.updatedAt)}`}
          </span>
        </div>
        <p className="post-detail-caption">{post.caption}</p>
        <div className="post-detail-tags">
          {post.tags.map((tag) => (
            <span className="tag" key={tag}>{tag}</span>
          ))}
          {post.aiGenerated && (
            <span className="mini-ai-tag">
              <Sparkles size={9} /> AI-assisted
            </span>
          )}
        </div>
        {post.status === 'published' ? (
          <div className="post-detail-stats">
            <div>
              <strong>{formatCompact(post.metrics.impressions)}</strong>
              <span><Eye size={11} /> Impressions</span>
            </div>
            <div>
              <strong>{formatCompact(engagement)}</strong>
              <span><Heart size={11} /> Interactions</span>
            </div>
            <div>
              <strong>{formatCompact(post.metrics.comments)}</strong>
              <span><MessageCircle size={11} /> Comments</span>
            </div>
          </div>
        ) : (
          <div className="post-detail-note">
            <CalendarDays size={14} />
            <span>
              {post.status === 'scheduled'
                ? `Queued for ${formatScheduled(post.scheduledAt)}${post.autoPublish ? ' · auto-publish is on' : ''}`
                : 'This post is still a draft. Edit it whenever you’re ready.'}
            </span>
          </div>
        )}
        {post.status !== 'published' && (
          <Link href={`/composer?edit=${post.id}`} className="btn btn-secondary btn-sm post-detail-edit">
            <Pencil size={13} /> Edit in composer <ArrowRight size={13} />
          </Link>
        )}
      </div>
    </div>
  );
}
