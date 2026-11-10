'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Bookmark,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Heart,
  ImagePlus,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Play,
  Plus,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  WandSparkles,
  X,
} from 'lucide-react';
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  Account,
  AiGenerationResult,
  AiStatus,
  AiVariant,
  MediaAsset,
  Platform,
  Post,
} from '@/lib/types';
import { PLATFORM_META, TONES } from '@/lib/platforms';
import { groupAccountsByPlatform, platformsForAccountIds } from '@/lib/accounts';
import { apiRequest, refreshNotifications, refreshWorkspaceCounts } from '@/lib/client';
import { formatCompact, formatRelative, formatScheduled, localDateTimeInput, toIsoFromLocal } from '@/lib/format';
import { useToast } from '@/components/ToastProvider';
import {
  Avatar,
  LiveDot,
  Modal,
  PageHeader,
  PlatformIcon,
  Spinner,
  Toggle,
} from '@/components/ui';

const LIBRARY_IMAGES = [
  { url: '/images/autumn.jpg', alt: 'Autumn editorial' },
  { url: '/images/studio.jpg', alt: 'Creative studio' },
  { url: '/images/ceramics.jpg', alt: 'Ceramics' },
  { url: '/images/coffee.jpg', alt: 'Coffee still life' },
  { url: '/images/creator.jpg', alt: 'Writing at a desk' },
  { url: '/images/flowers.jpg', alt: 'Flowers' },
  { url: '/images/prompts.jpg', alt: 'Notebook prompts' },
  { url: '/images/mountains.jpg', alt: 'Mountain landscape' },
  { url: '/images/fashion.jpg', alt: 'Fashion editorial' },
  { url: '/images/skincare.jpg', alt: 'Skincare products' },
];

const DEFAULT_PLATFORMS: Platform[] = ['instagram', 'threads'];

type StudioHandoff = {
  caption?: string;
  title?: string;
  platforms?: Platform[];
  tone?: string;
};
export default function ComposerPage() {
  return (
    <Suspense
      fallback={
        <div className="composer-page">
          <PageHeader title="Composer" subtitle="Getting your workspace ready…" />
        </div>
      }
    >
      <ComposerInner />
    </Suspense>
  );
}

function ComposerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const initialDate = searchParams.get('date');
  const { toast } = useToast();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(Boolean(editId));
  const [saving, setSaving] = useState<'draft' | 'action' | null>(null);

  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [pendingPlatforms, setPendingPlatforms] = useState<Platform[] | null>(null);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [overrides, setOverrides] = useState<Partial<Record<Platform, string>>>({});
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [scheduleOn, setScheduleOn] = useState(Boolean(initialDate));
  const [autoPublish, setAutoPublish] = useState(true);
  const [scheduledAt, setScheduledAt] = useState(() => {
    if (initialDate) {
      const date = new Date(`${initialDate}T10:00`);
      if (!Number.isNaN(date.getTime())) return localDateTimeInput(date);
    }
    const date = new Date();
    date.setHours(date.getHours() + 1, 0, 0, 0);
    return localDateTimeInput(date);
  });
  const [previewAccountId, setPreviewAccountId] = useState('');
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiTone, setAiTone] = useState<(typeof TONES)[number]>('Warm & friendly');
  const [aiResult, setAiResult] = useState<AiGenerationResult | null>(null);
  const [aiVariant, setAiVariant] = useState(0);
  const [aiLoading, setAiLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  const selectedAccounts = useMemo(
    () => accounts.filter((account) => accountIds.includes(account.id)),
    [accounts, accountIds],
  );
  const platforms = useMemo(
    () => platformsForAccountIds(accounts, accountIds),
    [accounts, accountIds],
  );
  const accountGroups = useMemo(() => groupAccountsByPlatform(accounts), [accounts]);
  const previewAccount =
    selectedAccounts.find((account) => account.id === previewAccountId) ?? selectedAccounts[0];
  const previewPlatform = previewAccount?.platform ?? platforms[0] ?? 'instagram';

  useEffect(() => {
    apiRequest<{ accounts: Account[] }>('/api/connections')
      .then((data) => setAccounts(data.accounts))
      .catch(() => toast('Could not load your connected accounts.', 'error'));
    apiRequest<AiStatus>('/api/ai/settings')
      .then(setAiStatus)
      .catch(() => undefined);
  }, [toast]);

  // Choose sensible defaults once accounts arrive. Primary accounts per platform
  // mirror the old single-account behaviour without hiding the others.
  useEffect(() => {
    if (accounts.length === 0 || editId || initializedRef.current) return;
    initializedRef.current = true;
    if (pendingPlatforms && pendingPlatforms.length > 0) {
      const ids = pendingPlatforms
        .map(
          (platform) =>
            accounts.find((account) => account.platform === platform && account.isPrimary)?.id ??
            accounts.find((account) => account.platform === platform)?.id,
        )
        .filter((id): id is string => Boolean(id));
      setAccountIds(ids);
      setPreviewAccountId(ids[0] ?? '');
      setPendingPlatforms(null);
      return;
    }
    const defaults = DEFAULT_PLATFORMS.map(
      (platform) =>
        accounts.find((account) => account.platform === platform && account.isPrimary)?.id ??
        accounts.find((account) => account.platform === platform)?.id,
    ).filter((id): id is string => Boolean(id));
    setAccountIds(defaults);
    setPreviewAccountId(defaults[0] ?? '');
  }, [accounts, editId, pendingPlatforms]);

  // Studio hand-off may arrive before accounts have loaded.
  useEffect(() => {
    if (editId || searchParams.get('from') !== 'studio') return;
    let draft: StudioHandoff | null = null;
    try {
      const raw = window.sessionStorage.getItem('sway:studio-draft');
      if (!raw) return;
      window.sessionStorage.removeItem('sway:studio-draft');
      draft = JSON.parse(raw) as StudioHandoff;
    } catch {
      return;
    }
    if (!draft) return;
    if (draft.caption) setCaption(draft.caption);
    if (draft.title) setTitle(draft.title);
    if (Array.isArray(draft.platforms) && draft.platforms.length > 0) {
      setPendingPlatforms(draft.platforms);
    }
    if (draft.tone && TONES.includes(draft.tone as (typeof TONES)[number])) {
      setAiTone(draft.tone as (typeof TONES)[number]);
    }
    toast('The AI draft is in the composer. Add media and your timing.');
  }, [editId, searchParams, toast]);

  useEffect(() => {
    if (!editId) return;
    setLoading(true);
    apiRequest<{ post: Post }>(`/api/posts/${editId}`)
      .then(({ post }) => {
        setTitle(post.title ?? '');
        setCaption(post.caption);
        setAccountIds(post.accountIds ?? []);
        setMedia(post.media);
        setOverrides(post.overrides ?? {});
        setPreviewAccountId(post.accountIds?.[0] ?? '');
        setAutoPublish(post.autoPublish);
        if (post.scheduledAt) {
          setScheduleOn(true);
          setScheduledAt(localDateTimeInput(new Date(post.scheduledAt)));
        } else if (post.status === 'scheduled') {
          setScheduleOn(true);
        }
        if (post.status === 'published') {
          toast('Published posts are read-only. Duplicate it to make changes.', 'info');
        }
      })
      .catch((reason: Error) => {
        toast(reason.message, 'error');
        router.replace('/content');
      })
      .finally(() => setLoading(false));
  }, [editId, router, toast]);

  const selectedMeta = platforms.map((platform) => PLATFORM_META[platform]);
  const minLimit = selectedMeta.length ? Math.min(...selectedMeta.map((meta) => meta.limit)) : 2200;
  const overLimit = selectedMeta.filter((meta) => caption.length > meta.limit);
  const missingArtwork =
    (platforms.includes('instagram') || platforms.includes('tiktok')) && media.length === 0;
  const previewCaption = overrides[previewPlatform]?.trim() || caption;
  const activeVariant: AiVariant | null = aiResult?.variants[aiVariant] ?? null;

  const checklist = useMemo(
    () => [
      {
        ok: caption.trim().length > 0,
        label: 'Write your caption',
        detail: caption.trim().length > 0 ? `${caption.length} characters` : 'A hook is a good place to start.',
      },
      {
        ok: accountIds.length > 0,
        label: 'Choose your accounts',
        detail: accountIds.length
          ? `${accountIds.length} account${accountIds.length === 1 ? '' : 's'} · ${platforms.length} platform${platforms.length === 1 ? '' : 's'}`
          : 'Pick at least one account.',
      },
      {
        ok: !missingArtwork,
        label: 'Add visual content',
        detail: missingArtwork ? 'Instagram and TikTok need media.' : media.length ? `${media.length} media item${media.length > 1 ? 's' : ''}` : 'Optional for this selection.',
      },
      {
        ok: !overLimit.length,
        label: 'Check channel limits',
        detail: overLimit.length ? `Too long for ${overLimit.map((meta) => meta.name).join(', ')}` : 'Looking good.',
      },
    ],
    [caption, accountIds.length, platforms.length, media.length, missingArtwork, overLimit],
  );

  function toggleAccount(account: Account) {
    if (!account.connected && !accountIds.includes(account.id)) {
      toast(`${account.displayName} is disconnected. Reconnect it first.`, 'error');
      return;
    }
    setAccountIds((current) => {
      const next = current.includes(account.id)
        ? current.filter((id) => id !== account.id)
        : [...current, account.id];
      if (next.length === 0) {
        toast('Keep at least one account selected.', 'info');
        return current;
      }
      if (!next.includes(previewAccountId)) setPreviewAccountId(next[0]);
      return next;
    });
  }

  function togglePlatformGroup(platform: Platform) {
    const group = accounts.filter((account) => account.platform === platform);
    if (group.length === 0) {
      toast(`No ${PLATFORM_META[platform].name} account is connected yet.`, 'error');
      return;
    }
    const allSelected = group.every((account) => accountIds.includes(account.id));
    if (allSelected) {
      const next = accountIds.filter((id) => !group.some((account) => account.id === id));
      if (next.length === 0) {
        toast('Keep at least one account selected.', 'info');
        return;
      }
      setAccountIds(next);
      if (!next.includes(previewAccountId)) setPreviewAccountId(next[0]);
    } else {
      const additions = group.filter((account) => account.connected).map((account) => account.id);
      if (additions.length === 0) {
        toast(`${PLATFORM_META[platform].name} accounts are disconnected.`, 'error');
        return;
      }
      setAccountIds((current) => [...new Set([...current, ...additions])]);
    }
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    let uploaded = 0;
    for (const file of files) {
      const formData = new FormData();
      formData.append('file', file);
      try {
        const data = await apiRequest<{ asset: MediaAsset }>('/api/upload', {
          method: 'POST',
          body: formData,
        });
        setMedia((current) => [...current, data.asset]);
        uploaded += 1;
      } catch (reason) {
        toast(reason instanceof Error ? reason.message : 'Upload failed.', 'error');
      }
    }
    if (uploaded > 0) toast(`${uploaded} ${uploaded === 1 ? 'file' : 'files'} added.`);
    setUploading(false);
  }

  function addLibraryImage(image: { url: string; alt: string }) {
    if (media.some((item) => item.url === image.url)) {
      toast('That image is already in your post.', 'info');
      return;
    }
    setMedia((current) => [
      ...current,
      { id: crypto.randomUUID(), url: image.url, type: 'image', alt: image.alt },
    ]);
  }

  async function generateCaption() {
    const topic = aiPrompt.trim() || caption.trim() || title.trim();
    if (!topic) {
      toast('Tell the AI what the post is about first.', 'error');
      return;
    }
    setAiLoading(true);
    try {
      const result = await apiRequest<AiGenerationResult>('/api/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          topic,
          platforms,
          tone: aiTone,
          goal: 'Grow engagement',
          context: caption.trim() ? `Existing notes: ${caption}` : undefined,
          variantCount: 3,
        }),
      });
      setAiResult(result);
      setAiVariant(0);
      toast(
        result.provider === 'demo'
          ? 'Three demo drafts are ready.'
          : `${result.providerName} drafted three options.`,
      );
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : 'The AI provider could not write that draft.', 'error');
    } finally {
      setAiLoading(false);
    }
  }

  function applyVariant(variant: AiVariant) {
    setCaption(variant.caption);
    toast('Draft added to your caption.');
  }

  function validate(nextStatus: 'draft' | 'scheduled' | 'published'): string | null {
    if (nextStatus === 'draft') {
      if (!caption.trim() && media.length === 0) return 'Add a caption or media before saving a draft.';
      return null;
    }
    if (!caption.trim()) return 'Add a caption before publishing.';
    if (!accountIds.length) return 'Choose at least one account.';
    if (missingArtwork) return 'Instagram and TikTok need at least one image or video.';
    if (overLimit.length) return `Shorten the caption for ${overLimit.map((meta) => meta.name).join(', ')}.`;
    const disconnected = selectedAccounts.filter((account) => !account.connected);
    if (disconnected.length > 0) {
      return `${disconnected.map((account) => account.displayName).join(', ')} ${
        disconnected.length === 1 ? 'is' : 'are'
      } disconnected. Reconnect before publishing.`;
    }
    if (nextStatus === 'scheduled') {
      const iso = toIsoFromLocal(scheduledAt);
      if (!iso) return 'Choose a valid publish time.';
      if (new Date(iso).getTime() < Date.now() + 60_000) return 'Choose a time in the future.';
    }
    return null;
  }

  async function save(kind: 'draft' | 'action') {
    const nextStatus: 'draft' | 'scheduled' | 'published' =
      kind === 'draft' ? 'draft' : scheduleOn ? 'scheduled' : 'published';
    const error = validate(nextStatus);
    if (error) {
      toast(error, 'error');
      return;
    }

    setSaving(kind);
    const payload = {
      title: title.trim() || caption.split('\n')[0].slice(0, 80),
      caption,
      accountIds,
      platforms,
      media,
      overrides,
      status: nextStatus,
      scheduledAt: nextStatus === 'scheduled' ? toIsoFromLocal(scheduledAt) : undefined,
      autoPublish,
      aiGenerated: Boolean(aiResult),
    };

    try {
      if (editId) {
        await apiRequest<{ post: Post }>(`/api/posts/${editId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        toast(
          nextStatus === 'draft'
            ? 'Draft saved.'
            : nextStatus === 'scheduled'
              ? 'Post scheduled. We’ll handle the rest.'
              : 'Post updated.',
        );
      } else {
        await apiRequest<{ post: Post }>('/api/posts', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        toast(
          nextStatus === 'draft'
            ? 'Draft saved.'
            : nextStatus === 'scheduled'
              ? 'Post scheduled. We’ll handle the rest.'
              : 'Your post is live in the sandbox.',
        );
      }
      refreshWorkspaceCounts();
      refreshNotifications();
      router.push('/content');
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : 'Could not save this post.', 'error');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="composer-page">
      <PageHeader
        eyebrow={
          <>
            <Link href="/content" className="back-link">
              <ArrowLeft size={12} /> Content
            </Link>
            <span className="eyebrow-slash">/</span>
            {editId ? 'Edit post' : 'New post'}
          </>
        }
        title={
          <>
            {editId ? 'Refine your post' : 'Create something'} <em>worth sharing</em>
            {editId ? '.' : '.'}
          </>
        }
        subtitle="Write once, tailor for each channel, and let Sway handle the timing."
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => void save('draft')}
              disabled={saving !== null || loading}
            >
              {saving === 'draft' ? <Spinner size={14} /> : null}
              Save draft
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void save('action')}
              disabled={saving !== null || loading}
            >
              {saving === 'action' ? (
                <Spinner size={14} />
              ) : scheduleOn ? (
                <CalendarClock size={15} />
              ) : (
                <Send size={14} />
              )}
              {scheduleOn ? 'Schedule post' : 'Publish now'}
            </button>
          </>
        }
      />

      <div className="composer-layout">
        <div className="composer-main">
          <section className="card composer-card">
            <div className="composer-section">
              <div className="section-label-row">
                <div>
                  <p className="composer-section-label">Publish to</p>
                  <p className="hint">Choose one or more accounts. Each platform can have several.</p>
                </div>
                <span className="pill">
                  {accountIds.length} account{accountIds.length === 1 ? '' : 's'} · {platforms.length} platform{platforms.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="account-picker">
                {accountGroups.map((group) => {
                  const meta = PLATFORM_META[group.platform];
                  const selectedCount = group.accounts.filter((account) =>
                    accountIds.includes(account.id),
                  ).length;
                  return (
                    <div className="account-group" key={group.platform}>
                      <div className="account-group-head">
                        <span className="account-group-title">
                          <PlatformIcon platform={group.platform} badge size={15} />
                          {meta.name}
                          <small>{group.accounts.length} connected</small>
                        </span>
                        <button
                          type="button"
                          className="account-group-toggle"
                          onClick={() => togglePlatformGroup(group.platform)}
                        >
                          {selectedCount === group.accounts.length ? 'Clear' : 'Select all'}
                        </button>
                      </div>
                      <div className="account-choice-list">
                        {group.accounts.map((account) => {
                          const selected = accountIds.includes(account.id);
                          return (
                            <button
                              key={account.id}
                              className={`account-choice ${selected ? 'account-choice-selected' : ''} ${!account.connected ? 'account-choice-disabled' : ''}`}
                              onClick={() => toggleAccount(account)}
                              type="button"
                            >
                              <Avatar name={account.displayName} src="/avatars/maya.jpg" size={26} />
                              <span className="account-choice-copy">
                                <strong>
                                  {account.displayName}
                                  {account.isPrimary && <em className="account-primary-tag">Primary</em>}
                                </strong>
                                <small>
                                  {account.handle} · {formatCompact(account.followers)} followers
                                </small>
                              </span>
                              <span className="channel-check">
                                {!account.connected ? (
                                  <Lock size={10} />
                                ) : selected ? (
                                  <Check size={11} strokeWidth={3} />
                                ) : null}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {accountGroups.length === 0 && (
                  <p className="hint">
                    No accounts yet. <Link href="/connections">Connect your first account</Link>.
                  </p>
                )}
              </div>
            </div>

            <div className="composer-divider" />

            <div className="composer-section">
              <div className="ai-inline-bar">
                <span className="ai-inline-icon">
                  <Sparkles size={16} />
                </span>
                <div>
                  <strong>Start with AI</strong>
                  <span>Turn a rough idea into a scroll-stopping first draft.</span>
                </div>
                <span className={`ai-status ${aiStatus?.connected ? 'ai-status-on' : ''}`}>
                  <LiveDot tone={aiStatus?.connected ? 'live' : 'quiet'} />
                  {aiStatus?.connected ? aiStatus.providerName : 'Demo mode'}
                </span>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setAiOpen((open) => !open)}
                  type="button"
                >
                  {aiOpen ? 'Close' : <><WandSparkles size={13} /> Write with AI</>}
                </button>
              </div>

              {aiOpen && (
                <div className="ai-inline-panel">
                  <div className="ai-panel-top">
                    <div className="field ai-prompt-field">
                      <label className="label" htmlFor="ai-prompt">
                        What is this post about?
                      </label>
                      <textarea
                        id="ai-prompt"
                        className="textarea"
                        rows={3}
                        placeholder="e.g. A behind-the-scenes look at our autumn campaign and the local makers we worked with…"
                        value={aiPrompt}
                        onChange={(event) => setAiPrompt(event.target.value)}
                      />
                    </div>
                    <div className="ai-tone-row">
                      <div className="field">
                        <label className="label" htmlFor="ai-tone">Tone</label>
                        <select
                          id="ai-tone"
                          className="select"
                          value={aiTone}
                          onChange={(event) => setAiTone(event.target.value as (typeof TONES)[number])}
                        >
                          {TONES.map((tone) => (
                            <option key={tone}>{tone}</option>
                          ))}
                        </select>
                      </div>
                      <button
                        className="btn btn-primary ai-generate-button"
                        onClick={() => void generateCaption()}
                        disabled={aiLoading}
                      >
                        {aiLoading ? <Spinner size={14} /> : <Sparkles size={14} />}
                        {aiLoading ? 'Writing…' : aiResult ? 'Write again' : 'Generate drafts'}
                      </button>
                    </div>
                  </div>

                  {aiResult && activeVariant && (
                    <div className="ai-result">
                      <div className="ai-result-head">
                        <span className={`pill ${aiResult.provider !== 'demo' ? 'pill-accent' : ''}`}>
                          <Sparkles size={10} />
                          {aiResult.providerName}
                        </span>
                        <div className="ai-variant-nav">
                          {aiResult.variants.map((_, index) => (
                            <button
                              key={index}
                              className={aiVariant === index ? 'is-active' : ''}
                              onClick={() => setAiVariant(index)}
                            >
                              {index + 1}
                            </button>
                          ))}
                        </div>
                        <span className="ai-result-count">
                          {activeVariant.caption.length} chars
                        </span>
                      </div>
                      <p className="ai-hook">{activeVariant.hook}</p>
                      <p className="ai-caption-preview">{activeVariant.caption}</p>
                      <div className="ai-result-actions">
                        <span className="ai-insight">{aiResult.insight}</span>
                        <button className="btn btn-sm btn-accent" onClick={() => applyVariant(activeVariant)}>
                          Use this draft <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  )}
                  {!aiStatus?.connected && (
                    <p className="ai-connect-note">
                      You’re using Sway’s demo writer. <Link href="/connections#ai">Connect an AI provider</Link> for drafts in your own voice.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="composer-divider" />

            <div className="composer-section">
              <div className="field">
                <div className="label-row">
                  <label className="label" htmlFor="post-caption">Caption</label>
                  <span className={`character-count ${overLimit.length ? 'character-count-over' : ''}`}>
                    {caption.length.toLocaleString()} / {minLimit.toLocaleString()}
                  </span>
                </div>
                <textarea
                  id="post-caption"
                  className="composer-caption"
                  rows={8}
                  placeholder="What do you want to share? Start with the line that makes someone stop scrolling…"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value)}
                />
              </div>
              <div className="caption-tools">
                <div className="caption-tools-left">
                  <button type="button" className="toolbar-button" onClick={() => setAiOpen(true)}>
                    <Sparkles size={12} /> Improve
                  </button>
                  <button
                    type="button"
                    className="toolbar-button"
                    onClick={() => setCustomizeOpen((open) => !open)}
                  >
                    <Clapperboard size={12} /> Fine-tune per channel
                  </button>
                </div>
                <span className="hint">Line breaks are preserved</span>
              </div>

              {customizeOpen && (
                <div className="override-list">
                  {platforms.map((platform) => (
                    <div className="override-row" key={platform}>
                      <div className="override-head">
                        <span>
                          <PlatformIcon platform={platform} size={13} />
                          {PLATFORM_META[platform].name}
                        </span>
                        <span className={`character-count ${(overrides[platform]?.length ?? 0) > PLATFORM_META[platform].limit ? 'character-count-over' : ''}`}>
                          {(overrides[platform]?.length ?? 0).toLocaleString()} / {PLATFORM_META[platform].limit.toLocaleString()}
                        </span>
                      </div>
                      <textarea
                        className="input override-textarea"
                        rows={2}
                        placeholder="Leave empty to use the main caption"
                        value={overrides[platform] ?? ''}
                        onChange={(event) =>
                          setOverrides((current) => ({ ...current, [platform]: event.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="field composer-title-field">
                <label className="label" htmlFor="post-title">Internal title <span className="optional-label">optional</span></label>
                <input
                  id="post-title"
                  className="input"
                  placeholder="Give this post a name for your team"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
            </div>

            <div className="composer-divider" />

            <div className="composer-section">
              <div className="section-label-row">
                <div>
                  <p className="composer-section-label">Media</p>
                  <p className="hint">The first image becomes your cover.</p>
                </div>
                <button className="text-link" type="button" onClick={() => setLibraryOpen(true)}>
                  <ImagePlus size={12} /> Media library
                </button>
              </div>

              <div
                className={`upload-zone ${dragging ? 'upload-zone-dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  void uploadFiles(Array.from(event.dataTransfer.files));
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click();
                }}
              >
                {uploading ? (
                  <>
                    <Spinner size={20} />
                    <strong>Uploading your media…</strong>
                  </>
                ) : (
                  <>
                    <span className="upload-icon">
                      <UploadCloud size={20} />
                    </span>
                    <div>
                      <strong>Drag & drop or <span>browse</span></strong>
                      <p>JPG, PNG, WEBP, MP4 or MOV · up to 25 MB</p>
                    </div>
                  </>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/quicktime,video/webm"
                  multiple
                  hidden
                  onChange={(event) => {
                    void uploadFiles(Array.from(event.target.files ?? []));
                    event.target.value = '';
                  }}
                />
              </div>

              {media.length > 0 && (
                <div className="media-grid">
                  {media.map((item, index) => (
                    <div className="media-tile" key={item.id}>
                      {item.type === 'video' ? (
                        <video src={item.url} muted aria-label={item.alt ?? 'Video upload'} />
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.url} alt={item.alt ?? 'Post media'} />
                      )}
                      {index === 0 && <span className="cover-badge">Cover</span>}
                      <button
                        type="button"
                        className="media-remove"
                        aria-label="Remove media"
                        onClick={() => setMedia((current) => current.filter((candidate) => candidate.id !== item.id))}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  <button type="button" className="media-add" onClick={() => setLibraryOpen(true)} aria-label="Add media">
                    <Plus size={18} />
                  </button>
                </div>
              )}
            </div>

            <div className="composer-divider" />

            <div className="composer-section">
              <div className="section-label-row">
                <div>
                  <p className="composer-section-label">Publishing</p>
                  <p className="hint">Pick the moment, or let it go live right now.</p>
                </div>
                <div className="schedule-toggle">
                  <span>Schedule for later</span>
                  <Toggle checked={scheduleOn} onChange={setScheduleOn} label="Schedule for later" />
                </div>
              </div>

              {scheduleOn ? (
                <div className="schedule-panel">
                  <div className="field">
                    <label className="label" htmlFor="scheduled-at">Date & time</label>
                    <input
                      id="scheduled-at"
                      type="datetime-local"
                      className="input"
                      value={scheduledAt}
                      min={localDateTimeInput()}
                      onChange={(event) => setScheduledAt(event.target.value)}
                    />
                  </div>
                  <div className="schedule-summary">
                    <CalendarClock size={18} />
                    <div>
                      <strong>{formatScheduled(toIsoFromLocal(scheduledAt))}</strong>
                      <span>Your local time · your audience is usually online then</span>
                    </div>
                  </div>
                  <label className="auto-publish-row">
                    <span>
                      <strong>Auto-publish</strong>
                      <small>Sway will publish automatically when the time comes.</small>
                    </span>
                    <Toggle checked={autoPublish} onChange={setAutoPublish} label="Auto-publish" />
                  </label>
                </div>
              ) : (
                <div className="publish-now-note">
                  <Send size={16} />
                  <div>
                    <strong>This will publish immediately</strong>
                    <span>It will appear in your content library as published.</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        <aside className="composer-aside">
          <div className="preview-card">
            <div className="preview-head">
              <div>
                <h2>Live preview</h2>
                <p>How it will look on each channel</p>
              </div>
              <span className="preview-live">
                <LiveDot tone="quiet" /> Preview
              </span>
            </div>
            <div className="preview-platform-tabs">
              {selectedAccounts.map((account) => {
                const samePlatform = selectedAccounts.filter(
                  (candidate) => candidate.platform === account.platform,
                ).length;
                return (
                  <button
                    key={account.id}
                    className={previewAccount?.id === account.id ? 'is-active' : ''}
                    onClick={() => setPreviewAccountId(account.id)}
                    title={`${account.displayName} · ${account.handle}`}
                  >
                    <PlatformIcon platform={account.platform} size={12} />
                    {samePlatform > 1
                      ? account.displayName.split(' ').slice(0, 2).join(' ')
                      : PLATFORM_META[account.platform].shortName}
                  </button>
                );
              })}
            </div>

            <PostPreview
              platform={previewPlatform}
              account={previewAccount}
              caption={previewCaption}
              media={media}
              title={title}
            />
            <p className="preview-footnote">
              <Lock size={10} /> Sandbox preview · live publishing uses real platform formatting.
            </p>
          </div>

          <div className="post-check-card">
            <div className="post-check-head">
              <h3>Post check</h3>
              <span className={checklist.every((item) => item.ok) ? 'check-ready' : 'check-in-progress'}>
                {checklist.filter((item) => item.ok).length}/{checklist.length}
              </span>
            </div>
            {checklist.map((item) => (
              <div className={`check-row ${item.ok ? 'check-row-ok' : ''}`} key={item.label}>
                <span className="check-icon">{item.ok ? <Check size={10} strokeWidth={3} /> : <span />}</span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
              </div>
            ))}
            {scheduleOn && (
              <div className="post-check-schedule">
                <CalendarClock size={14} />
                Scheduled {formatRelative(toIsoFromLocal(scheduledAt) ?? new Date())}
              </div>
            )}
          </div>
        </aside>
      </div>

      <Modal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        title="Media library"
        description="Choose from a few of our favourite studio images. You can add more than one."
        size="lg"
        footer={
          <>
            <span className="hint">{media.length} selected</span>
            <button className="btn btn-secondary" onClick={() => setLibraryOpen(false)}>Done</button>
          </>
        }
      >
        <div className="library-grid">
          {LIBRARY_IMAGES.map((image) => {
            const selected = media.some((item) => item.url === image.url);
            return (
              <button
                key={image.url}
                className={`library-tile ${selected ? 'library-tile-selected' : ''}`}
                onClick={() => addLibraryImage(image)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.alt} />
                <span>
                  {selected ? <Check size={14} strokeWidth={3} /> : <Plus size={14} />}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

function PostPreview({
  platform,
  account,
  caption,
  media,
  title,
}: {
  platform: Platform;
  account?: Account;
  caption: string;
  media: MediaAsset[];
  title: string;
}) {
  const [slide, setSlide] = useState(0);
  const current = media[slide] ?? media[0];
  const isYouTube = platform === 'youtube';
  const isThreads = platform === 'threads';
  const displayName = account?.displayName ?? 'Maya Studio';
  const handle = account?.handle ?? '@maya.studio';
  const followers = account?.followers ?? 0;

  useEffect(() => setSlide(0), [platform, media.length]);

  return (
    <div className={`social-preview social-preview-${platform}`}>
      <div className="social-preview-top">
        <Avatar name={displayName} src="/avatars/maya.jpg" size={30} />
        <div>
          <strong>{isYouTube ? displayName : handle.replace(/^@/, '')}</strong>
          <span>
            {isYouTube
              ? `${formatCompact(followers)} subscribers`
              : isThreads
                ? 'just now'
                : `${formatCompact(followers)} followers`}
          </span>
        </div>
        <PlatformIcon platform={platform} size={13} />
        <MoreHorizontal size={16} />
      </div>

      {isThreads ? (
        <div className="threads-preview-body">
          <p>{caption || 'Your thread will appear here. Start with a thought worth sharing.'}</p>
          {current && (
            <span className="threads-preview-media">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={current.url} alt={current.alt ?? ''} />
            </span>
          )}
          <div className="threads-actions">
            <Heart size={15} />
            <MessageCircle size={15} />
            <Send size={15} />
            <span>1h</span>
          </div>
        </div>
      ) : (
        <>
          <div className={`preview-media ${isYouTube ? 'preview-media-wide' : ''}`}>
            {current ? (
              current.type === 'video' ? (
                <video src={current.url} muted autoPlay loop playsInline />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={current.url} alt={current.alt ?? ''} />
              )
            ) : (
              <span className="preview-media-empty">
                <ImagePlus size={24} />
                <b>{isYouTube ? 'Your video cover' : 'Your image'}</b>
                <small>Add media to bring this post to life</small>
              </span>
            )}
            {isYouTube && (
              <span className="preview-play">
                <Play size={17} fill="currentColor" />
              </span>
            )}
            {media.length > 1 && (
              <>
                <button
                  className="preview-slide-nav preview-slide-prev"
                  aria-label="Previous media"
                  onClick={() => setSlide((index) => (index - 1 + media.length) % media.length)}
                >
                  <ChevronLeft size={12} />
                </button>
                <button
                  className="preview-slide-nav preview-slide-next"
                  aria-label="Next media"
                  onClick={() => setSlide((index) => (index + 1) % media.length)}
                >
                  <ChevronRight size={12} />
                </button>
                <span className="preview-dots">
                  {media.map((item, index) => (
                    <i key={item.id} className={slide === index ? 'is-active' : ''} />
                  ))}
                </span>
              </>
            )}
          </div>

          <div className="preview-actions">
            <div>
              <Heart size={18} />
              <MessageCircle size={18} />
              <Send size={17} />
            </div>
            <Bookmark size={18} />
          </div>

          <div className="preview-caption">
            <span className="preview-likes">2,841 likes</span>
            {isYouTube && title.trim() && <strong className="preview-video-title">{title}</strong>}
            <p>{caption || 'Your caption will appear here. Add a few words…'}</p>
            <span className="preview-time">View all 184 comments · 2 hours ago</span>
          </div>
        </>
      )}
    </div>
  );
}
