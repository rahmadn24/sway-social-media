'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  ChartSpline,
  Cable,
  CheckCircle2,
  ChevronRight,
  FileText,
  Inbox,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  MessageCircle,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  SquarePen,
  X,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppNotification, Conversation, OverviewData, Post } from '@/lib/types';
import { formatRelative } from '@/lib/format';
import { apiRequest } from '@/lib/client';
import { Avatar, Brand, Kbd, LiveDot, PlatformIcon, Spinner, StatusBadge } from './ui';

const NAV_ITEMS = [
  { href: '/', label: 'Overview', icon: LayoutDashboard },
  { href: '/studio', label: 'Claude Studio', icon: Sparkles, ai: true },
  { href: '/composer', label: 'Composer', icon: SquarePen },
  { href: '/content', label: 'Content', icon: LibraryBig },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/inbox', label: 'Inbox', icon: Inbox, count: 'inbox' as const },
  { href: '/analytics', label: 'Analytics', icon: ChartSpline },
];

const MANAGE_ITEMS = [{ href: '/connections', label: 'Connections', icon: Cable }];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/studio': 'Claude Studio',
  '/composer': 'Composer',
  '/content': 'Content',
  '/calendar': 'Calendar',
  '/inbox': 'Inbox',
  '/analytics': 'Analytics',
  '/connections': 'Connections',
};

const ALL_ITEMS = [...NAV_ITEMS, ...MANAGE_ITEMS];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unread, setUnread] = useState(5);
  const [scheduled, setScheduled] = useState(0);
  const [nextPost, setNextPost] = useState<Post | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [user, setUser] = useState<{ email: string; role: string } | null>(null);
  const [resetting, setResetting] = useState(false);
  const notificationButton = useRef<HTMLButtonElement>(null);
  const notificationPanel = useRef<HTMLDivElement>(null);

  const refreshCounts = useCallback(async () => {
    try {
      const overview = await apiRequest<OverviewData>('/api/overview?range=7d');
      setUnread(overview.unreadCount);
      setScheduled(overview.scheduledCount);
      setNextPost(overview.upcoming[0] ?? null);
    } catch {
      // Keep the last known counts when the badge request fails.
    }
  }, []);

  const refreshNotificationFeed = useCallback(async () => {
    try {
      const data = await apiRequest<{ notifications: AppNotification[]; unread: number }>(
        '/api/notifications',
      );
      setNotifications(data.notifications);
      setNotificationCount(data.unread);
    } catch {
      // Notifications are auxiliary; the shell stays usable when this fails.
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: { email: string; role: string } }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  const isLogin = pathname === '/login';

  useEffect(() => {
    if (isLogin) return;
    void refreshCounts();
    void refreshNotificationFeed();
    void refreshUser();
  }, [pathname, isLogin, refreshCounts, refreshNotificationFeed, refreshUser]);

  useEffect(() => {
    const onCounts = () => void refreshCounts();
    const onNotifications = () => void refreshNotificationFeed();
    window.addEventListener('sway:refresh-counts', onCounts);
    window.addEventListener('sway:refresh-notifications', onNotifications);
    return () => {
      window.removeEventListener('sway:refresh-counts', onCounts);
      window.removeEventListener('sway:refresh-notifications', onNotifications);
    };
  }, [refreshCounts, refreshNotificationFeed]);

  // The scheduler publishes in the background, so poll while the tab is open.
  useEffect(() => {
    if (isLogin) return;
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshNotificationFeed();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refreshNotificationFeed, isLogin]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen((open) => !open);
        return;
      }
      // "C" creates a post, but never while the user is typing somewhere.
      if (event.key.toLowerCase() === 'c' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        const typing =
          target instanceof HTMLElement &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable);
        if (typing || searchOpen) return;
        event.preventDefault();
        router.push('/composer');
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [router, searchOpen]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        notificationPanel.current?.contains(event.target as Node) ||
        notificationButton.current?.contains(event.target as Node)
      ) {
        return;
      }
      setNotificationsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [notificationsOpen]);

  async function markAllRead() {
    setNotificationCount(0);
    setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    try {
      await apiRequest('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'read-all' }),
      });
    } catch {
      void refreshNotificationFeed();
    }
  }

  async function handleLogout() {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
    } catch {
      // The cookie is cleared server-side; navigate even if the call fails.
    }
    router.push('/login');
    router.refresh();
  }

  async function handleReset() {
    if (resetting) return;
    const confirmed = window.confirm(
      'Reset the demo workspace? All posts, conversations and analytics return to the fresh demo data. The connected AI provider key is kept.',
    );
    if (!confirmed) return;
    setResetting(true);
    try {
      await apiRequest('/api/auth/reset', { method: 'POST' });
      window.location.reload();
    } catch {
      setResetting(false);
    }
  }

  const pageTitle = PAGE_TITLES[pathname] ?? 'Sway';

  // The login page stands alone, without the sidebar and top bar.
  if (isLogin) return <>{children}</>;

  return (
    <div className="app-shell">
      <div
        className={`sidebar-overlay ${mobileOpen ? 'sidebar-overlay-visible' : ''}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-top">
          <Brand />
          <button
            className="sidebar-close icon-button icon-button-dark"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X size={19} />
          </button>
        </div>

        <Link href="/composer" className="create-button">
          <span className="create-icon">
            <Plus size={17} strokeWidth={2.4} />
          </span>
          Create post
          <span className="create-shortcut">C</span>
        </Link>

        <nav className="side-nav" aria-label="Main navigation">
          <p className="nav-label">Workspace</p>
          {NAV_ITEMS.map((item) => (
            <NavItem
              key={item.href}
              {...item}
              active={pathname === item.href}
              badge={
                item.count === 'inbox'
                  ? unread
                  : item.href === '/content'
                    ? scheduled
                    : undefined
              }
              badgeLabel={item.count === 'inbox' ? 'unread' : 'scheduled'}
            />
          ))}
          <p className="nav-label nav-label-manage">Manage</p>
          {MANAGE_ITEMS.map((item) => (
            <NavItem key={item.href} {...item} active={pathname === item.href} />
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="sidebar-queue">
          <div className="sidebar-queue-top">
            <span className="queue-orbit">
              <Zap size={15} />
            </span>
            <span>
              Auto-publish <b>on</b>
            </span>
            <LiveDot />
          </div>
          <p>
            {nextPost?.scheduledAt
              ? `Next post ${formatRelative(nextPost.scheduledAt)} on ${nextPost.platforms.length} channel${nextPost.platforms.length === 1 ? '' : 's'}.`
              : 'Everything is published. Your queue is clear.'}
          </p>
          <Link href="/calendar" className="queue-link">
            View queue <ArrowUpRight size={13} />
          </Link>
        </div>

        <div className="sidebar-account">
          <div className="sidebar-account-user">
            <Avatar name={user?.email ?? 'Sway'} size={34} />
            <span className="sidebar-user-copy">
              <strong>{user?.email ?? 'Signed in'}</strong>
              <span>{user?.role === 'admin' ? 'Admin' : 'Demo account'}</span>
            </span>
          </div>
          <div className="sidebar-account-actions">
            <button type="button" onClick={() => void handleReset()} disabled={resetting}>
              <RotateCcw size={13} />
              {resetting ? 'Resetting…' : 'Reset demo data'}
            </button>
            <button type="button" onClick={() => void handleLogout()}>
              <LogOut size={13} />
              Log out
            </button>
          </div>
        </div>
      </aside>

      <div className="app-body">
        <header className="topbar">
          <div className="topbar-mobile">
            <button
              className="icon-button"
              aria-label="Open navigation"
              onClick={() => setMobileOpen(true)}
            >
              <Menu size={20} />
            </button>
            <Brand compact />
          </div>

          <button className="global-search" onClick={() => setSearchOpen(true)}>
            <Search size={17} />
            <span>Search posts, messages, anything…</span>
            <Kbd>⌘ K</Kbd>
          </button>

          <div className="topbar-actions">
            <span className="topbar-status desktop-only">
              <LiveDot />
              All channels synced
            </span>
            <div className="notification-wrap">
              <button
                ref={notificationButton}
                className={`icon-button notification-button ${notificationsOpen ? 'is-active' : ''}`}
                aria-label={`Notifications${notificationCount ? `, ${notificationCount} unread` : ''}`}
                onClick={() => setNotificationsOpen((open) => !open)}
              >
                <Bell size={19} />
                {notificationCount > 0 && <span className="notification-dot">{notificationCount}</span>}
              </button>
              {notificationsOpen && (
                <div className="notification-panel" ref={notificationPanel}>
                  <div className="notification-head">
                    <div>
                      <h3>Notifications</h3>
                      <p>{notificationCount ? `${notificationCount} unread updates` : 'You’re all caught up'}</p>
                    </div>
                    {notificationCount > 0 && (
                      <button className="text-button" onClick={() => void markAllRead()}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="notification-list">
                    {notifications.length === 0 ? (
                      <p className="notification-empty">No updates yet.</p>
                    ) : (
                      notifications.slice(0, 6).map((notification) => (
                        <div
                          key={notification.id}
                          className={`notification-item ${notification.read ? '' : 'notification-unread'}`}
                        >
                          <span className="notification-type">
                            {notification.type === 'engagement' ? (
                              <ChartSpline size={16} />
                            ) : notification.type === 'post' ? (
                              <CheckCircle2 size={16} />
                            ) : notification.type === 'mention' ? (
                              <MessageCircle size={16} />
                            ) : (
                              <Zap size={16} />
                            )}
                          </span>
                          <div>
                            <strong>{notification.title}</strong>
                            <p>{notification.body}</p>
                            <span>{formatRelative(notification.createdAt)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <Link href="/inbox" className="notification-footer" onClick={() => setNotificationsOpen(false)}>
                    Open unified inbox <ArrowUpRight size={14} />
                  </Link>
                </div>
              )}
            </div>
            <Link href="/connections" className="topbar-profile" aria-label="Open account settings">
              <Avatar name={user?.email ?? 'Sway'} size={34} />
            </Link>
          </div>
        </header>

        <main className="main-content" key={pathname}>
          {children}
        </main>
      </div>

      {searchOpen && <CommandPalette onClose={() => setSearchOpen(false)} pageTitle={pageTitle} />}
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  badge,
  ai,
  badgeLabel,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  active: boolean;
  badge?: number;
  ai?: boolean;
  badgeLabel?: string;
}) {
  return (
    <Link href={href} className={`nav-item ${active ? 'nav-item-active' : ''}`}>
      <Icon size={18} strokeWidth={1.9} />
      <span>{label}</span>
      {ai && <span className="nav-ai">AI</span>}
      {typeof badge === 'number' && badge > 0 && (
        <span className="nav-count" aria-label={`${badge} ${badgeLabel ?? ''}`}>
          {badge}
        </span>
      )}
    </Link>
  );
}

function CommandPalette({ onClose, pageTitle }: { onClose: () => void; pageTitle: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setPosts([]);
      setConversations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = window.setTimeout(() => {
      Promise.all([
        apiRequest<{ posts: Post[] }>(`/api/posts?q=${encodeURIComponent(query.trim())}`),
        apiRequest<{ conversations: Conversation[] }>(
          `/api/conversations?q=${encodeURIComponent(query.trim())}`,
        ),
      ])
        .then(([postData, conversationData]) => {
          setPosts(postData.posts.slice(0, 4));
          setConversations(conversationData.conversations.slice(0, 3));
        })
        .catch(() => {
          setPosts([]);
          setConversations([]);
        })
        .finally(() => setLoading(false));
    }, 220);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const pages = ALL_ITEMS.filter((item) =>
    `${item.label} ${item.href}`.toLowerCase().includes(query.trim().toLowerCase()),
  ).slice(0, 5);

  const results = [
    ...pages.map((item) => ({
      id: `page-${item.href}`,
      kind: 'page' as const,
      label: item.label,
      sub: 'Go to page',
      href: item.href,
      icon: item.icon,
    })),
    ...posts.map((post) => ({
      id: post.id,
      kind: 'post' as const,
      label: post.title || post.caption.slice(0, 60),
      sub: `${post.status} · ${post.platforms.length} channels`,
      href: `/content?focus=${post.id}`,
      post,
    })),
    ...conversations.map((conversation) => ({
      id: conversation.id,
      kind: 'conversation' as const,
      label: `${conversation.participant.name} on ${conversation.platform}`,
      sub: conversation.preview,
      href: `/inbox?id=${conversation.id}`,
      conversation,
    })),
  ];

  function go(href: string) {
    onClose();
    router.push(href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && results[activeIndex]) {
      event.preventDefault();
      go(results[activeIndex].href);
    }
  }

  return (
    <div className="command-layer">
      <button className="command-backdrop" aria-label="Close search" onClick={onClose} />
      <div className="command-palette" role="dialog" aria-modal="true" aria-label="Global search">
        <div className="command-input-wrap">
          <Search size={20} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={`Search ${pageTitle.toLowerCase()}, posts, people…`}
            aria-label="Search"
          />
          {loading ? <Spinner /> : <Kbd>esc</Kbd>}
        </div>

        <div className="command-results">
          {!query.trim() ? (
            <>
              <p className="command-section-label">Jump to</p>
              {ALL_ITEMS.map((item, index) => (
                <button
                  key={item.href}
                  className={`command-item ${activeIndex === index ? 'command-item-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(item.href)}
                >
                  <span className="command-icon">
                    <item.icon size={17} />
                  </span>
                  <span className="command-copy">
                    <strong>{item.label}</strong>
                    <small>{item.href === '/studio' ? 'Your AI writing partner' : 'Sway workspace'}</small>
                  </span>
                  <span className="command-enter">
                    <ChevronRight size={15} />
                  </span>
                </button>
              ))}
              <p className="command-section-label command-section-spacer">Create</p>
              <button className="command-item" onClick={() => go('/composer')}>
                <span className="command-icon command-icon-accent">
                  <SquarePen size={17} />
                </span>
                <span className="command-copy">
                  <strong>New social post</strong>
                  <small>Compose for all five channels</small>
                </span>
                <span className="command-enter">
                  <ChevronRight size={15} />
                </span>
              </button>
              <button className="command-item" onClick={() => go('/studio')}>
                <span className="command-icon command-icon-accent">
                  <Sparkles size={17} />
                </span>
                <span className="command-copy">
                  <strong>Generate with AI</strong>
                  <small>Turn an idea into content</small>
                </span>
                <span className="command-enter">
                  <ChevronRight size={15} />
                </span>
              </button>
            </>
          ) : results.length === 0 && !loading ? (
            <div className="command-empty">
              <FileText size={22} />
              <p>No results for “{query}”.</p>
              <span>Try a post title, channel or a person’s name.</span>
            </div>
          ) : (
            <>
              {results.map((result, index) => (
                <button
                  key={result.id}
                  className={`command-item ${activeIndex === index ? 'command-item-active' : ''}`}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(result.href)}
                >
                  <span className="command-icon">
                    {result.kind === 'page' ? (
                      <result.icon size={17} />
                    ) : result.kind === 'post' ? (
                      <FileText size={17} />
                    ) : (
                      <MessageCircle size={17} />
                    )}
                  </span>
                  <span className="command-copy">
                    <strong>{result.label}</strong>
                    <small>{result.sub}</small>
                  </span>
                  <span className="command-enter">
                    <ChevronRight size={15} />
                  </span>
                </button>
              ))}
            </>
          )}
        </div>

        <div className="command-footer">
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> to navigate
          </span>
          <span>
            <Kbd>↵</Kbd> to open
          </span>
          <span className="command-brand">
            <Sparkles size={12} /> Sway search
          </span>
        </div>
      </div>
    </div>
  );
}
