'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronDown,
  CornerDownLeft,
  Inbox,
  Mail,
  MessageCircle,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Account, AiProviderId, Conversation, InboxType, Platform } from '@/lib/types';
import { PLATFORM_LIST, PLATFORM_META } from '@/lib/platforms';
import { apiRequest, refreshWorkspaceCounts } from '@/lib/client';
import { formatMessageTime, formatRelative, formatShortDate } from '@/lib/format';
import { useToast } from '@/components/ToastProvider';
import {
  Avatar,
  EmptyState,
  PageHeader,
  PlatformIcon,
  Skeleton,
  Spinner,
} from '@/components/ui';

type TypeFilter = 'all' | InboxType;
type PlatformFilter = 'all' | Platform;

export default function InboxPage() {
  return (
    <Suspense fallback={<InboxFallback />}>
      <InboxInner />
    </Suspense>
  );
}

function InboxFallback() {
  return (
    <div className="inbox-page">
      <PageHeader
        eyebrow="Unified inbox"
        title="Every conversation, one place."
        subtitle="Loading comments and messages…"
      />
      <div className="inbox-layout">
        <div className="card inbox-list-card">
          <div className="inbox-list-loading">
            <Skeleton style={{ height: 34, width: '100%' }} />
            <Skeleton style={{ height: 64, width: '100%' }} />
            <Skeleton style={{ height: 64, width: '100%' }} />
            <Skeleton style={{ height: 64, width: '100%' }} />
          </div>
        </div>
        <div className="card inbox-thread-card">
          <div className="inbox-thread-empty">
            <Skeleton style={{ width: 50, height: 50, borderRadius: 99 }} />
            <Skeleton style={{ width: 200, height: 12 }} />
            <Skeleton style={{ width: 140, height: 9 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function InboxInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [accountFilter, setAccountFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('id'));
  const [mobileThreadOpen, setMobileThreadOpen] = useState(Boolean(searchParams.get('id')));
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestionProvider, setSuggestionProvider] = useState<AiProviderId | 'demo' | null>(null);
  const [suggestionProviderName, setSuggestionProviderName] = useState('');
  const initialised = useRef(false);
  const initialId = useRef(searchParams.get('id'));
  const threadMessagesRef = useRef<HTMLDivElement>(null);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const load = useCallback(
    async (mode: 'initial' | 'refresh' = 'initial') => {
      if (mode === 'initial') setLoading(true);
      else setRefreshing(true);
      try {
        const data = await apiRequest<{ conversations: Conversation[] }>('/api/conversations');
        setConversations(data.conversations);
        return data.conversations;
      } catch (reason) {
        toast(reason instanceof Error ? reason.message : 'Could not load your inbox.', 'error');
        return null;
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    void load('initial').then((data) => {
      if (!data || initialised.current) return;
      initialised.current = true;
      const fromUrl = initialId.current;
      if (fromUrl && data.some((conversation) => conversation.id === fromUrl)) {
        setSelectedId(fromUrl);
        setMobileThreadOpen(true);
      } else if (data.length > 0) {
        setSelectedId(data[0].id);
      }
    });
  }, [load]);

  useEffect(() => {
    apiRequest<{ accounts: Account[] }>('/api/connections')
      .then((data) => setAccounts(data.accounts))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (accountFilter === 'all') return;
    const account = accounts.find((candidate) => candidate.id === accountFilter);
    if (!account) return;
    if (platformFilter !== 'all' && account.platform !== platformFilter) setAccountFilter('all');
  }, [platformFilter, accountFilter, accounts]);

  const accountOptions =
    platformFilter === 'all'
      ? accounts
      : accounts.filter((account) => account.platform === platformFilter);

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? null,
    [conversations, selectedId],
  );
  const selectedAccount = accounts.find((account) => account.id === selected?.accountId);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations
      .filter((conversation) => {
        if (typeFilter !== 'all' && conversation.type !== typeFilter) return false;
        if (platformFilter !== 'all' && conversation.platform !== platformFilter) return false;
        if (accountFilter !== 'all' && conversation.accountId !== accountFilter) return false;
        if (!needle) return true;
        return `${conversation.participant.name} ${conversation.participant.handle} ${conversation.preview} ${conversation.subject ?? ''}`
          .toLowerCase()
          .includes(needle);
      })
      .sort((a, b) => {
        if (a.unread !== b.unread) return a.unread ? -1 : 1;
        return b.lastMessageAt.localeCompare(a.lastMessageAt);
      });
  }, [conversations, typeFilter, platformFilter, accountFilter, query]);

  const counts = useMemo(
    () => ({
      unread: conversations.filter((conversation) => conversation.unread).length,
      dm: conversations.filter((conversation) => conversation.type === 'dm').length,
      comment: conversations.filter((conversation) => conversation.type === 'comment').length,
    }),
    [conversations],
  );

  useEffect(() => {
    const container = threadMessagesRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [selected?.id, selected?.messages.length]);

  useEffect(() => {
    if (!mobileThreadOpen || !selectedId) return;
    if (!window.matchMedia('(max-width: 900px)').matches) return;
    const timer = window.setTimeout(() => {
      document.querySelector('.inbox-thread-card')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [mobileThreadOpen, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const next = searchParams.get('id');
    if (next !== selectedId) {
      router.replace(`/inbox?id=${selectedId}`, { scroll: false });
    }
  }, [selectedId, router, searchParams]);

  function patchConversation(id: string, payload: Partial<Conversation>) {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === id ? { ...conversation, ...payload } : conversation,
      ),
    );
  }

  function markRead(conversation: Conversation) {
    if (!conversation.unread) return;
    patchConversation(conversation.id, { unread: false });
    void apiRequest(`/api/conversations/${conversation.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ unread: false }),
    })
      .then(() => refreshWorkspaceCounts())
      .catch(() => undefined);
  }

  function openConversation(conversation: Conversation) {
    setSelectedId(conversation.id);
    setMobileThreadOpen(true);
    setReply('');
    setSuggestionProvider(null);
    setSuggestionProviderName('');
    markRead(conversation);
  }

  async function toggleStar(conversation: Conversation) {
    const next = !conversation.starred;
    patchConversation(conversation.id, { starred: next });
    try {
      await apiRequest(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ starred: next }),
      });
    } catch (reason) {
      patchConversation(conversation.id, { starred: conversation.starred });
      toast(reason instanceof Error ? reason.message : 'Could not update that conversation.', 'error');
    }
  }

  async function toggleResolved(conversation: Conversation) {
    const next = conversation.status === 'resolved' ? 'open' : 'resolved';
    patchConversation(conversation.id, { status: next });
    try {
      await apiRequest(`/api/conversations/${conversation.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: next }),
      });
      toast(next === 'resolved' ? 'Conversation resolved.' : 'Conversation reopened.');
    } catch (reason) {
      patchConversation(conversation.id, { status: conversation.status });
      toast(reason instanceof Error ? reason.message : 'Could not update that conversation.', 'error');
    }
  }

  async function markAllRead() {
    const unread = conversations.filter((conversation) => conversation.unread);
    if (unread.length === 0) {
      toast('Your inbox is already caught up.', 'info');
      return;
    }
    setConversations((current) =>
      current.map((conversation) => ({ ...conversation, unread: false })),
    );
    try {
      await Promise.all(
        unread.map((conversation) =>
          apiRequest(`/api/conversations/${conversation.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ unread: false }),
          }),
        ),
      );
      refreshWorkspaceCounts();
      toast(`${unread.length} conversation${unread.length === 1 ? '' : 's'} marked as read.`);
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : 'Could not mark everything as read.', 'error');
      void load('refresh');
    }
  }

  async function suggestReply() {
    if (!selected) return;
    setSuggesting(true);
    try {
      const data = await apiRequest<{
        suggestion: string;
        provider: AiProviderId | 'demo';
        providerName: string;
      }>('/api/ai/reply', {
        method: 'POST',
        body: JSON.stringify({ conversationId: selected.id }),
      });
      setReply(data.suggestion);
      setSuggestionProvider(data.provider);
      setSuggestionProviderName(data.providerName);
      replyRef.current?.focus();
      toast(
        data.provider === 'demo'
          ? 'A demo reply is ready. Connect an AI provider for a personal draft.'
          : `${data.providerName} drafted a reply in your voice.`,
        data.provider === 'demo' ? 'info' : 'success',
      );
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : 'Could not draft a reply.', 'error');
    } finally {
      setSuggesting(false);
    }
  }

  async function sendReply() {
    if (!selected) return;
    const text = reply.trim();
    if (!text) {
      toast('Write a reply first.', 'error');
      replyRef.current?.focus();
      return;
    }
    setSending(true);
    try {
      const data = await apiRequest<{ conversation: Conversation }>(
        `/api/conversations/${selected.id}/reply`,
        {
          method: 'POST',
          body: JSON.stringify({ text }),
        },
      );
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === data.conversation.id ? data.conversation : conversation,
        ),
      );
      setReply('');
      setSuggestionProvider(null);
      setSuggestionProviderName('');
      refreshWorkspaceCounts();
      toast('Reply sent.');
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : 'Could not send that reply.', 'error');
    } finally {
      setSending(false);
    }
  }

  const filterTabs: Array<{ id: TypeFilter; label: string; icon: React.ReactNode; count: number }> = [
    { id: 'all', label: 'All', icon: <Inbox size={12} />, count: conversations.length },
    { id: 'comment', label: 'Comments', icon: <MessageCircle size={12} />, count: counts.comment },
    { id: 'dm', label: 'DMs', icon: <Mail size={12} />, count: counts.dm },
  ];

  return (
    <div className="inbox-page">
      <PageHeader
        eyebrow={
          <>
            Unified inbox
            <span className="eyebrow-dot" />
            {counts.unread > 0 ? `${counts.unread} waiting for you` : 'All caught up'}
          </>
        }
        title={
          <>
            Real people, <em>real conversations</em>.
          </>
        }
        subtitle="Every comment and DM from all five platforms and every account, answered without switching tabs."
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => void load('refresh')}
              disabled={refreshing || loading}
            >
              <RefreshCw size={14} className={refreshing ? 'spinner' : undefined} />
              {refreshing ? 'Syncing…' : 'Sync inbox'}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void markAllRead()}
              disabled={counts.unread === 0}
            >
              <CheckCheck size={15} />
              Mark all read
            </button>
          </>
        }
      />

      <div className="inbox-stat-strip">
        <span className="inbox-stat">
          <span className="inbox-stat-icon inbox-stat-icon-lime">
            <Mail size={14} />
          </span>
          <strong>{counts.unread}</strong> unread
        </span>
        <span className="inbox-stat">
          <span className="inbox-stat-icon inbox-stat-icon-pink">
            <MessageCircle size={14} />
          </span>
          <strong>{counts.comment}</strong> comments
        </span>
        <span className="inbox-stat">
          <span className="inbox-stat-icon inbox-stat-icon-blue">
            <MessageSquare size={14} />
          </span>
          <strong>{counts.dm}</strong> direct messages
        </span>
        <span className="inbox-stat-note">
          <span className="live-dot" />
          {accounts.length > 0
            ? `Synced across ${accounts.length} account${accounts.length === 1 ? '' : 's'}`
            : 'Synced across 5 channels'}
        </span>
      </div>

      <div className={`inbox-layout ${mobileThreadOpen ? 'inbox-mobile-thread' : ''}`}>
        <section className="card inbox-list-card" aria-label="Conversations">
          <div className="inbox-list-head">
            <div className="inbox-list-title">
              <h2>Conversations</h2>
              <span>{filtered.length}</span>
            </div>
            <label className="inbox-search">
              <Search size={14} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people or messages…"
                aria-label="Search conversations"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={11} />
                </button>
              )}
            </label>
            <div className="inbox-filters">
              <div className="inbox-filter-tabs" role="tablist" aria-label="Filter inbox type">
                {filterTabs.map((tab) => (
                  <button
                    key={tab.id}
                    role="tab"
                    aria-selected={typeFilter === tab.id}
                    className={typeFilter === tab.id ? 'is-active' : ''}
                    onClick={() => setTypeFilter(tab.id)}
                  >
                    {tab.icon}
                    {tab.label}
                    <span>{tab.count}</span>
                  </button>
                ))}
              </div>
              <div className="select-wrap inbox-platform-filter">
                <select
                  value={platformFilter}
                  onChange={(event) => {
                    setPlatformFilter(event.target.value as PlatformFilter);
                    setAccountFilter('all');
                  }}
                  aria-label="Filter by channel"
                >
                  <option value="all">All channels</option>
                  {PLATFORM_LIST.map((meta) => (
                    <option value={meta.id} key={meta.id}>
                      {meta.name}
                    </option>
                  ))}
                </select>
                <ChevronDown size={12} />
              </div>
              <div className="select-wrap inbox-platform-filter">
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
                <ChevronDown size={12} />
              </div>
            </div>
          </div>

          <div className="conversation-list">
            {loading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div className="conversation-item conversation-item-loading" key={index}>
                    <Skeleton style={{ width: 38, height: 38, borderRadius: 99 }} />
                    <div>
                      <Skeleton style={{ width: '52%', height: 10 }} />
                      <Skeleton style={{ width: '86%', height: 9, marginTop: 8 }} />
                    </div>
                  </div>
                ))
              : filtered.map((conversation) => {
                  const meta = PLATFORM_META[conversation.platform];
                  const account = accounts.find(
                    (candidate) => candidate.id === conversation.accountId,
                  );
                  return (
                    <button
                      key={conversation.id}
                      className={`conversation-item ${
                        conversation.id === selectedId ? 'conversation-item-active' : ''
                      } ${conversation.unread ? 'conversation-item-unread' : ''}`}
                      onClick={() => openConversation(conversation)}
                    >
                      <span className="conversation-avatar">
                        <Avatar
                          name={conversation.participant.name}
                          src={conversation.participant.avatar}
                          size={38}
                        />
                        <PlatformIcon
                          platform={conversation.platform}
                          size={8}
                          badge
                          className="conversation-platform"
                        />
                      </span>
                      <span className="conversation-copy">
                        <span className="conversation-name-line">
                          <strong>{conversation.participant.name}</strong>
                          <span>{formatRelative(conversation.lastMessageAt)}</span>
                        </span>
                        <span className="conversation-meta-line">
                          {conversation.type === 'dm' ? <Mail size={9} /> : <MessageCircle size={9} />}
                          {meta.name}
                          {account && <span className="conversation-account">· {account.displayName}</span>}
                          {conversation.starred && <Star size={9} fill="currentColor" className="conversation-star" />}
                        </span>
                        <span className="conversation-preview">{conversation.preview}</span>
                        {conversation.subject && (
                          <span className="conversation-subject">
                            on “{conversation.subject}”
                          </span>
                        )}
                      </span>
                      {conversation.unread && <span className="conversation-unread-dot" />}
                    </button>
                  );
                })}
            {!loading && filtered.length === 0 && (
              <EmptyState
                icon={<Inbox size={20} />}
                title="Nothing in this view"
                description={
                  query
                    ? `No conversations match “${query}”. Try a different name or word.`
                    : 'No conversations match these filters. Try another channel or type.'
                }
                action={
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setQuery('');
                      setTypeFilter('all');
                      setPlatformFilter('all');
                    }}
                  >
                    Clear filters
                  </button>
                }
              />
            )}
          </div>

          <div className="inbox-list-foot">
            <span>
              {counts.unread > 0
                ? `${counts.unread} unread conversation${counts.unread === 1 ? '' : 's'}`
                : 'Everything is read'}
            </span>
            <span className="inbox-foot-dot" />
            <span>{conversations.length} total</span>
          </div>
        </section>

        <section className="card inbox-thread-card" aria-label="Conversation">
          {selected ? (
            <>
              <header className="thread-head">
                <button
                  className="thread-back"
                  onClick={() => setMobileThreadOpen(false)}
                  aria-label="Back to conversations"
                >
                  <ArrowLeft size={15} />
                </button>
                <span className="thread-avatar">
                  <Avatar
                    name={selected.participant.name}
                    src={selected.participant.avatar}
                    size={38}
                  />
                  <PlatformIcon
                    platform={selected.platform}
                    size={8}
                    badge
                    className="conversation-platform"
                  />
                </span>
                <div className="thread-head-copy">
                  <div className="thread-name-line">
                    <h2>{selected.participant.name}</h2>
                    <span className="thread-type-badge">
                      {selected.type === 'dm' ? <Mail size={9} /> : <MessageCircle size={9} />}
                      {selected.type === 'dm' ? 'DM' : 'Comment'}
                    </span>
                    {selected.status === 'resolved' && (
                      <span className="thread-resolved">
                        <Check size={9} /> Resolved
                      </span>
                    )}
                  </div>
                  <span className="thread-handle">
                    {selected.participant.handle} · {PLATFORM_META[selected.platform].name}
                    {selectedAccount && (
                      <span className="thread-account"> · {selectedAccount.displayName}</span>
                    )}
                  </span>
                </div>
                <div className="thread-head-actions">
                  <button
                    className={`thread-action ${selected.starred ? 'is-active' : ''}`}
                    onClick={() => void toggleStar(selected)}
                    aria-label={selected.starred ? 'Remove star' : 'Star conversation'}
                  >
                    <Star size={15} fill={selected.starred ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    className={`thread-action ${selected.status === 'resolved' ? 'is-resolved' : ''}`}
                    onClick={() => void toggleResolved(selected)}
                    aria-label={selected.status === 'resolved' ? 'Reopen conversation' : 'Resolve conversation'}
                  >
                    <Check size={15} />
                  </button>
                </div>
              </header>

              {selected.subject && (
                <div className="thread-subject">
                  <MessageCircle size={12} />
                  <span>
                    {selected.type === 'dm' ? 'About' : 'Comment on'}{' '}
                    <strong>{selected.subject}</strong>
                  </span>
                  {selected.postId && (
                    <Link href={`/content?focus=${selected.postId}`} className="thread-subject-link">
                      View post
                    </Link>
                  )}
                </div>
              )}

              <div className="thread-messages" ref={threadMessagesRef}>
                <div className="thread-day-label">
                  {formatShortDate(selected.messages[0]?.createdAt)}
                </div>
                {selected.messages.map((message) => {
                  const mine = message.from === 'me';
                  return (
                    <div
                      className={`message-row ${mine ? 'message-row-mine' : ''}`}
                      key={message.id}
                    >
                      {!mine && (
                        <Avatar
                          name={selected.participant.name}
                          src={selected.participant.avatar}
                          size={27}
                        />
                      )}
                      <div className={`message-bubble ${mine ? 'message-bubble-mine' : ''}`}>
                        <p>{message.text}</p>
                        <span>
                          {formatMessageTime(message.createdAt)}
                          {mine && <CheckCheck size={10} />}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="thread-reply">
                <div className="thread-reply-top">
                  <span className="replying-to">
                    Replying to <strong>{selected.participant.name}</strong> on{' '}
                    {PLATFORM_META[selected.platform].name}
                    {selectedAccount && ` · ${selectedAccount.displayName}`}
                  </span>
                  <button
                    className="btn btn-sm thread-suggest"
                    onClick={() => void suggestReply()}
                    disabled={suggesting || sending}
                    type="button"
                  >
                    {suggesting ? <Spinner size={12} /> : <Sparkles size={13} />}
                    {suggesting ? 'Writing…' : reply ? 'Suggest again' : 'Suggest a reply'}
                  </button>
                </div>
                {suggestionProvider && (
                  <div className="thread-suggestion-note">
                    <Sparkles size={10} />
                    {suggestionProvider === 'demo'
                      ? 'Demo draft — connect an AI provider in Connections for a more personal reply.'
                      : `Drafted by ${suggestionProviderName || 'your AI provider'}. Edit it before sending if you like.`}
                  </div>
                )}
                <div className="thread-composer">
                  <textarea
                    ref={replyRef}
                    className="thread-textarea"
                    rows={3}
                    placeholder={`Write a reply to ${selected.participant.name.split(' ')[0]}…`}
                    value={reply}
                    onChange={(event) => {
                      setReply(event.target.value);
                      setSuggestionProvider(null);
                      setSuggestionProviderName('');
                    }}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                        event.preventDefault();
                        void sendReply();
                      }
                    }}
                  />
                  <div className="thread-composer-foot">
                    <span className="thread-shortcut">
                      <CornerDownLeft size={10} /> ⌘ Enter to send
                    </span>
                    <span className={`character-count ${reply.length > 2000 ? 'character-count-over' : ''}`}>
                      {reply.length.toLocaleString()} / 2,000
                    </span>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => void sendReply()}
                      disabled={sending || !reply.trim()}
                    >
                      {sending ? <Spinner size={13} /> : <Send size={13} />}
                      {sending ? 'Sending…' : 'Send reply'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <EmptyState
              icon={<Inbox size={22} />}
              title="Pick a conversation"
              description="Choose someone from the list to read the thread and reply. No tab switching required."
            />
          )}
        </section>
      </div>
    </div>
  );
}
