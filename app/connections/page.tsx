'use client';

import Link from 'next/link';
import {
  ArrowRight,
  Cable,
  Check,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Unplug,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Account, AiProviderId, AiStatus, Platform } from '@/lib/types';
import { PLATFORM_LIST, PLATFORM_META } from '@/lib/platforms';
import { AI_PROVIDERS, AI_PROVIDER_LIST, modelLabel } from '@/lib/ai-providers';
import { groupAccountsByPlatform } from '@/lib/accounts';
import { apiRequest } from '@/lib/client';
import { formatCompact, formatRelative } from '@/lib/format';
import { useToast } from '@/components/ToastProvider';
import {
  Avatar,
  LiveDot,
  Modal,
  PageHeader,
  PlatformIcon,
  Skeleton,
  Spinner,
} from '@/components/ui';

type PublishingMode = 'sandbox' | 'live';
type ConnectionAction = 'connect' | 'disconnect' | 'refresh' | 'primary';

const ENV_SNIPPET = `# Use any supported AI provider through the environment
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-5-20250929

SOCIAL_PUBLISHING_MODE=live`;

export default function ConnectionsPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [publishingMode, setPublishingMode] = useState<PublishingMode>('sandbox');
  const [ai, setAi] = useState<AiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AiProviderId>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [aiError, setAiError] = useState('');
  const [savingAi, setSavingAi] = useState(false);
  const [disconnectingAi, setDisconnectingAi] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addPlatform, setAddPlatform] = useState<Platform>('instagram');
  const [addHandle, setAddHandle] = useState('');
  const [addName, setAddName] = useState('');
  const [addFollowers, setAddFollowers] = useState('');
  const [addError, setAddError] = useState('');
  const [addingAccount, setAddingAccount] = useState(false);

  const loadAccounts = useCallback(async () => {
    const data = await apiRequest<{ accounts: Account[]; publishingMode: PublishingMode }>(
      '/api/connections',
    );
    setAccounts(data.accounts);
    setPublishingMode(data.publishingMode);
  }, []);

  const loadAi = useCallback(async () => {
    const data = await apiRequest<AiStatus>('/api/ai/settings');
    setAi(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.allSettled([loadAccounts(), loadAi()]).then((results) => {
      if (cancelled) return;
      setLoading(false);
      if (results.some((result) => result.status === 'rejected')) {
        toast('Some connection details could not be loaded.', 'error');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [loadAccounts, loadAi, toast]);

  async function runConnectionAction(account: Account, action: ConnectionAction) {
    setPending(account.id);
    try {
      const data = await apiRequest<{ account: Account }>(`/api/connections/${account.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action }),
      });
      if (action === 'primary') {
        await loadAccounts();
      } else {
        setAccounts((current) =>
          current.map((candidate) => (candidate.id === account.id ? data.account : candidate)),
        );
      }
      toast(
        action === 'disconnect'
          ? `${account.displayName} disconnected. You can reconnect any time.`
          : action === 'connect'
            ? `${account.displayName} reconnected (sandbox connection).`
            : action === 'primary'
              ? `${account.displayName} is now the primary ${PLATFORM_META[account.platform].name} account.`
              : `${account.displayName} refreshed (sandbox connection).`,
      );
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : 'That connection action failed.', 'error');
    } finally {
      setPending(null);
    }
  }

  async function removeAccount(account: Account) {
    const meta = PLATFORM_META[account.platform];
    const confirmed = window.confirm(
      `Remove ${account.displayName}? Existing posts and conversations will be reassigned to another ${meta.name} account.`,
    );
    if (!confirmed) return;

    setPending(account.id);
    try {
      await apiRequest(`/api/connections/${account.id}`, { method: 'DELETE' });
      await loadAccounts();
      toast(`${account.displayName} removed. Related content was reassigned.`);
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : 'Could not remove that account.', 'error');
    } finally {
      setPending(null);
    }
  }

  async function refreshAll() {
    setPending('all');
    try {
      const results = await Promise.allSettled(
        accounts.map((account) =>
          apiRequest<{ account: Account }>(`/api/connections/${account.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ action: 'refresh' }),
          }),
        ),
      );
      const succeeded = results.filter((result) => result.status === 'fulfilled').length;
      await loadAccounts();
      toast(
        succeeded === accounts.length
          ? 'All accounts refreshed.'
          : `${succeeded} of ${accounts.length} accounts refreshed.`,
        succeeded === accounts.length ? 'success' : 'info',
      );
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : 'Could not refresh your accounts.', 'error');
    } finally {
      setPending(null);
    }
  }

  function openAddAccount(platform: Platform = 'instagram') {
    setAddPlatform(platform);
    setAddHandle('');
    setAddName('');
    setAddFollowers('');
    setAddError('');
    setAddOpen(true);
  }

  async function addAccount() {
    setAddError('');
    if (!addHandle.trim()) {
      setAddError(`Enter the ${PLATFORM_META[addPlatform].handleLabel} for this account.`);
      return;
    }
    setAddingAccount(true);
    try {
      const data = await apiRequest<{ account: Account }>('/api/connections', {
        method: 'POST',
        body: JSON.stringify({
          platform: addPlatform,
          handle: addHandle.trim(),
          displayName: addName.trim() || undefined,
          followers: addFollowers ? Number(addFollowers) : 0,
        }),
      });
      setAccounts((current) => [...current, data.account]);
      setAddOpen(false);
      toast(`${data.account.displayName} connected to your workspace.`);
    } catch (reason) {
      setAddError(reason instanceof Error ? reason.message : 'Could not add that account.');
    } finally {
      setAddingAccount(false);
    }
  }

  function applyProviderForm(id: AiProviderId) {
    const meta = AI_PROVIDERS[id];
    const status = ai?.providers.find((entry) => entry.id === id);
    setSelectedProvider(id);
    setSelectedModel(status?.model || meta.defaultModel);
    setBaseUrl(status?.baseUrl || meta.defaultBaseUrl);
    setApiKey('');
    setShowKey(false);
    setAiError('');
  }

  function openProviderModal() {
    const id = ai?.provider ?? 'anthropic';
    applyProviderForm(id);
    setProviderModalOpen(true);
  }

  function selectProvider(id: AiProviderId) {
    if (ai?.providerLocked && id !== ai.provider) {
      toast('The provider is managed by AI_PROVIDER in the environment.', 'info');
      return;
    }
    applyProviderForm(id);
  }

  async function saveAiSettings() {
    setAiError('');
    const meta = AI_PROVIDERS[selectedProvider];
    const status = ai?.providers.find((entry) => entry.id === selectedProvider);
    const envManaged = status?.source === 'env';

    if (!envManaged && meta.keyRequired && !apiKey.trim() && !status?.connected) {
      setAiError(`Enter your ${meta.name} API key.`);
      return;
    }

    setSavingAi(true);
    try {
      const payload: {
        provider: AiProviderId;
        apiKey?: string;
        model?: string;
        baseUrl?: string;
      } = {
        provider: selectedProvider,
        model: selectedModel.trim() || meta.defaultModel,
        baseUrl: baseUrl.trim(),
      };
      if (!envManaged && apiKey.trim()) payload.apiKey = apiKey.trim();

      const next = await apiRequest<AiStatus>('/api/ai/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setAi(next);
      setProviderModalOpen(false);
      setApiKey('');
      toast(
        next.connected
          ? `${next.providerName} is connected and ready to write.`
          : `${meta.name} settings saved.`,
      );
    } catch (reason) {
      setAiError(reason instanceof Error ? reason.message : `Could not connect to ${meta.name}.`);
    } finally {
      setSavingAi(false);
    }
  }

  async function disconnectAiProvider() {
    setDisconnectingAi(true);
    try {
      const next = await apiRequest<AiStatus>(
        `/api/ai/settings?provider=${selectedProvider}`,
        { method: 'DELETE' },
      );
      setAi(next);
      setProviderModalOpen(false);
      toast(
        next.connected
          ? 'That provider is still managed by the environment.'
          : 'Provider disconnected. Demo drafts will be used instead.',
        next.connected ? 'info' : 'success',
      );
    } catch (reason) {
      setAiError(
        reason instanceof Error ? reason.message : 'Could not disconnect that AI provider.',
      );
    } finally {
      setDisconnectingAi(false);
    }
  }

  async function copyEnv() {
    try {
      await navigator.clipboard.writeText(ENV_SNIPPET);
      toast('Environment snippet copied.');
    } catch {
      toast('Copy failed. Select the snippet manually.', 'error');
    }
  }

  const connectedCount = accounts.filter((account) => account.connected).length;
  const followers = accounts.reduce((total, account) => total + account.followers, 0);
  const grouped = useMemo(() => groupAccountsByPlatform(accounts), [accounts]);
  const aiConnected = Boolean(ai?.connected);
  const selectedMeta = AI_PROVIDERS[selectedProvider];
  const selectedStatus = ai?.providers.find((entry) => entry.id === selectedProvider);
  const selectedEnvManaged = selectedStatus?.source === 'env';
  const modelOptions =
    selectedStatus?.model && !selectedMeta.models.includes(selectedStatus.model)
      ? [selectedStatus.model, ...selectedMeta.models]
      : selectedMeta.models;

  return (
    <div className="connections-page">
      <PageHeader
        eyebrow={
          <>
            Connections
            <span className="eyebrow-dot" />
            {loading
              ? 'Checking accounts'
              : `${connectedCount} of ${accounts.length} accounts connected`}
          </>
        }
        title={
          <>
            Your accounts, <em>all in one place</em>.
          </>
        }
        subtitle="Manage several Instagram, YouTube, TikTok, Threads and Facebook accounts under one login, and choose the AI provider that writes in your voice."
        actions={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => void refreshAll()}
              disabled={loading || pending !== null || accounts.length === 0}
            >
              <RefreshCw size={14} className={pending === 'all' ? 'spinner' : undefined} />
              {pending === 'all' ? 'Refreshing…' : 'Refresh all'}
            </button>
            <button className="btn btn-secondary" onClick={() => openAddAccount()}>
              <Plus size={14} /> Add account
            </button>
            <button className="btn btn-primary" onClick={openProviderModal}>
              <Sparkles size={14} />
              {aiConnected ? 'Manage AI provider' : 'Connect AI'}
            </button>
          </>
        }
      />

      <div className="connections-summary-strip">
        <span className="connections-summary-item">
          <span className="connections-summary-icon connections-summary-icon-green">
            <Cable size={14} />
          </span>
          <strong>
            {connectedCount}/{accounts.length}
          </strong>{' '}
          accounts live
        </span>
        <span className="connections-summary-item">
          <Avatar name="Maya Studio" src="/avatars/maya.jpg" size={24} />
          <strong>{loading ? '—' : formatCompact(followers)}</strong> total followers
        </span>
        <span className="connections-summary-item">
          <span className="connections-summary-icon connections-summary-icon-lime">
            <Sparkles size={14} />
          </span>
          {ai?.providerName ?? 'AI'} <strong>{aiConnected ? 'ready' : 'demo mode'}</strong>
        </span>
        <span className="connections-summary-note">
          <LiveDot tone={publishingMode === 'sandbox' ? 'warn' : 'live'} />
          Publishing: {publishingMode}
        </span>
      </div>

      {publishingMode === 'sandbox' ? (
        <div className="publishing-banner">
          <span className="publishing-banner-icon">
            <ShieldCheck size={19} />
          </span>
          <div className="publishing-banner-copy">
            <strong>Sandbox publishing is on</strong>
            <p>
              Posts are validated and simulated end-to-end so you can test scheduling and
              auto-publishing safely. No live content is sent to a social network yet.
            </p>
          </div>
          <span className="pill pill-accent">
            <Lock size={10} /> Sandbox
          </span>
          <a href="#developer" className="text-link publishing-banner-link">
            How to go live <ArrowRight size={12} />
          </a>
        </div>
      ) : (
        <div className="publishing-banner">
          <span className="publishing-banner-icon">
            <ShieldCheck size={19} />
          </span>
          <div className="publishing-banner-copy">
            <strong>Live publishing mode is active</strong>
            <p>
              Sway will call your platform adapters in <code>lib/publishing.ts</code> when a post
              publishes. Platforms without an adapter fail with an explicit error — nothing falls
              back to the sandbox.
            </p>
          </div>
          <span className="pill pill-forest">
            <Lock size={10} /> Live
          </span>
          <a href="#developer" className="text-link publishing-banner-link">
            Review the adapter steps <ArrowRight size={12} />
          </a>
        </div>
      )}

      <section className="ai-connection" id="ai">
        <span className="ai-connection-orb">
          <Sparkles size={22} />
        </span>
        <div className="ai-connection-copy">
          <p className="ai-connection-eyebrow">AI writing partner</p>
          <h2>
            {aiConnected ? ai?.providerName : 'Any AI'}, in <em>your voice</em>.
          </h2>
          <p>
            Bring your own key from Anthropic, OpenAI, Google, Groq, OpenRouter, DeepSeek, Ollama
            or any OpenAI-compatible endpoint. Your key stays server-side; Sway only sends the
            prompt you ask for.
          </p>
          <div className="ai-status-row">
            <span className={`ai-status-pill ${aiConnected ? 'is-on' : ''}`}>
              <LiveDot tone={aiConnected ? 'live' : 'quiet'} />
              {aiConnected
                ? ai?.source === 'env'
                  ? `Connected via environment key`
                  : `Connected with your ${ai?.providerName} key`
                : 'Demo mode — no provider connected'}
            </span>
            {aiConnected && ai?.maskedKey && (
              <span className="ai-key-chip">
                <KeyRound size={10} /> {ai.maskedKey}
              </span>
            )}
            {aiConnected && <span className="ai-model-chip">{modelLabel(ai?.model)}</span>}
          </div>
        </div>
        <div className="ai-connection-actions">
          <button className="btn btn-accent" onClick={openProviderModal}>
            {aiConnected ? 'Manage AI provider' : 'Connect AI provider'}
            <ArrowRight size={13} />
          </button>
          <Link href="/studio" className="ai-studio-link">
            Open AI Studio <Sparkles size={12} />
          </Link>
        </div>
      </section>

      <div className="connection-section-head">
        <div>
          <h2 className="card-title">Accounts</h2>
          <p className="card-subtitle">
            Each platform can hold as many accounts as you need. Pick them individually in the
            composer.
          </p>
        </div>
        <span className="pill">
          {accounts.length} account{accounts.length === 1 ? '' : 's'} · {grouped.length} platform
          {grouped.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <div className="connection-grid">
          {PLATFORM_LIST.map((meta) => (
            <div className="card connection-card connection-card-loading" key={meta.id}>
              <div className="connection-loading-top">
                <Skeleton style={{ width: 42, height: 42, borderRadius: 11 }} />
                <div>
                  <Skeleton style={{ width: 90, height: 12 }} />
                  <Skeleton style={{ width: 120, height: 9, marginTop: 7 }} />
                </div>
              </div>
              <Skeleton style={{ height: 34, width: '100%' }} />
              <Skeleton style={{ height: 22, width: '70%' }} />
            </div>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <div className="card empty-card">
          <p className="hint">No accounts connected yet.</p>
          <button className="btn btn-primary" onClick={() => openAddAccount()}>
            <Plus size={14} /> Connect your first account
          </button>
        </div>
      ) : (
        <div className="connection-platform-list">
          {grouped.map((group) => {
            const meta = PLATFORM_META[group.platform];
            return (
              <section className="connection-platform-block" key={group.platform}>
                <div className="connection-platform-head">
                  <span className="connection-platform-title">
                    <PlatformIcon platform={group.platform} badge size={17} />
                    <h2>{meta.name}</h2>
                    <span className="pill">
                      {group.accounts.length} account{group.accounts.length === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="connection-platform-actions">
                    <span className="hint">{meta.formats}</span>
                    <button
                      className="btn btn-sm btn-secondary"
                      onClick={() => openAddAccount(group.platform)}
                    >
                      <Plus size={12} /> Add {meta.shortName}
                    </button>
                  </span>
                </div>
                <div className="connection-grid">
                  {group.accounts.map((account) => (
                    <ConnectionCard
                      key={account.id}
                      account={account}
                      pending={pending === account.id}
                      disabled={pending !== null}
                      onAction={(action) => void runConnectionAction(account, action)}
                      onRemove={() => void removeAccount(account)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="connections-lower-grid">
        <section id="developer" className="card developer-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">How live publishing fits in</h2>
              <p className="card-subtitle">
                Sway ships with a publishing boundary, ready for your platform adapters.
              </p>
            </div>
            <span className="pill pill-forest">
              <Cable size={10} /> Developer
            </span>
          </div>
          <div className="developer-steps">
            <div className="developer-step">
              <span className="developer-step-number">01</span>
              <div>
                <h3>Add OAuth credentials</h3>
                <p>
                  Create developer apps for each network and add their client IDs, secrets and
                  redirect URLs to your environment — per account.
                </p>
              </div>
            </div>
            <div className="developer-step">
              <span className="developer-step-number">02</span>
              <div>
                <h3>Implement the adapters</h3>
                <p>
                  Replace the sandbox transport in <code>lib/publishing.ts</code>. Keep the
                  account-aware <code>PlatformPublishResult</code> shape and the rest of Sway
                  keeps working.
                </p>
              </div>
            </div>
            <div className="developer-step">
              <span className="developer-step-number">03</span>
              <div>
                <h3>Switch the mode</h3>
                <p>
                  Set <code>SOCIAL_PUBLISHING_MODE=live</code>, connect real accounts, and
                  Sway’s scheduler will publish through your adapters.
                </p>
              </div>
            </div>
          </div>
          <div className="developer-code">
            <div className="developer-code-head">
              <span>
                <Lock size={10} /> .env.local
              </span>
              <button onClick={() => void copyEnv()} aria-label="Copy environment snippet">
                <Copy size={12} /> Copy
              </button>
            </div>
            <pre>
              <code>{ENV_SNIPPET}</code>
            </pre>
          </div>
        </section>

        <section className="card security-card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Good to know</h2>
              <p className="card-subtitle">How Sway handles your accounts and keys.</p>
            </div>
          </div>
          <div className="security-list">
            <div className="security-item">
              <span className="security-icon">
                <KeyRound size={15} />
              </span>
              <div>
                <strong>Keys stay server-side</strong>
                <p>
                  AI keys are stored in <code>data/ai.json</code> with local-only file permissions
                  and never exposed to the browser.
                </p>
              </div>
            </div>
            <div className="security-item">
              <span className="security-icon">
                <ShieldCheck size={15} />
              </span>
              <div>
                <strong>Validation before saving</strong>
                <p>
                  Sway checks a new AI key against the selected provider before storing it, so a
                  typo never becomes a broken connection.
                </p>
              </div>
            </div>
            <div className="security-item">
              <span className="security-icon">
                <RefreshCw size={15} />
              </span>
              <div>
                <strong>Tokens need care</strong>
                <p>
                  Real platform tokens expire. Sway already surfaces refresh prompts; your
                  adapter can hook into the same per-account connection actions.
                </p>
              </div>
            </div>
            <div className="security-item">
              <span className="security-icon">
                <Unplug size={15} />
              </span>
              <div>
                <strong>No lock-in</strong>
                <p>
                  Disconnect an account or AI provider at any time. Existing content and analytics
                  stay in your local workspace.
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add an account"
        description="Connect another account for one of your five platforms. This demo creates a sandbox connection instantly."
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void addAccount()}
              disabled={addingAccount}
            >
              {addingAccount ? <Spinner size={13} /> : <Plus size={13} />}
              {addingAccount ? 'Connecting…' : 'Connect account'}
            </button>
          </>
        }
      >
        <div className="account-modal">
          <div className="field">
            <span className="label">Platform</span>
            <div className="platform-pick-grid">
              {PLATFORM_LIST.map((meta) => (
                <button
                  key={meta.id}
                  type="button"
                  className={`platform-pick ${addPlatform === meta.id ? 'is-active' : ''}`}
                  onClick={() => setAddPlatform(meta.id)}
                >
                  <PlatformIcon platform={meta.id} badge size={15} />
                  {meta.name}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label className="label" htmlFor="add-handle">
              Handle
            </label>
            <input
              id="add-handle"
              className="input"
              placeholder={`@${PLATFORM_META[addPlatform].handleLabel}`}
              value={addHandle}
              onChange={(event) => setAddHandle(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="add-name">
              Display name <span className="optional-label">optional</span>
            </label>
            <input
              id="add-name"
              className="input"
              placeholder="Maya Studio Shop"
              value={addName}
              onChange={(event) => setAddName(event.target.value)}
            />
          </div>

          <div className="field">
            <label className="label" htmlFor="add-followers">
              Followers <span className="optional-label">optional</span>
            </label>
            <input
              id="add-followers"
              className="input"
              inputMode="numeric"
              placeholder="0"
              value={addFollowers}
              onChange={(event) => setAddFollowers(event.target.value.replace(/[^0-9]/g, ''))}
            />
            <p className="hint">
              Sandbox accounts start with the numbers you enter. Real OAuth connections would sync
              these automatically.
            </p>
          </div>

          {addError && (
            <div className="ai-modal-error">
              <span>{addError}</span>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={providerModalOpen}
        onClose={() => setProviderModalOpen(false)}
        title={aiConnected ? 'Manage AI provider' : 'Connect an AI provider'}
        description="Choose a provider, paste your key, and Sway will use it for drafts and reply suggestions."
        size="lg"
        footer={
          <>
            {selectedStatus?.source === 'local' && (
              <button
                className="btn btn-danger ai-disconnect"
                onClick={() => void disconnectAiProvider()}
                disabled={disconnectingAi || savingAi}
              >
                {disconnectingAi ? <Spinner size={13} /> : <Unplug size={13} />}
                {disconnectingAi ? 'Disconnecting…' : 'Disconnect'}
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => setProviderModalOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary"
              onClick={() => void saveAiSettings()}
              disabled={
                savingAi ||
                disconnectingAi ||
                Boolean(ai?.providerLocked && ai.provider !== selectedProvider)
              }
            >
              {savingAi ? <Spinner size={13} /> : <Check size={13} />}
              {savingAi
                ? 'Checking…'
                : selectedStatus?.connected
                  ? 'Save changes'
                  : `Connect ${selectedMeta.name}`}
            </button>
          </>
        }
      >
        <div className="ai-modal">
          <div className="provider-picker">
            {AI_PROVIDER_LIST.map((meta) => {
              const status = ai?.providers.find((entry) => entry.id === meta.id);
              const active = selectedProvider === meta.id;
              const locked = Boolean(ai?.providerLocked && ai.provider !== meta.id);
              return (
                <button
                  key={meta.id}
                  type="button"
                  className={`provider-choice ${active ? 'is-active' : ''} ${locked ? 'is-locked' : ''}`}
                  onClick={() => selectProvider(meta.id)}
                  aria-pressed={active}
                >
                  <span
                    className="provider-choice-mark"
                    style={{ background: meta.softColor, color: meta.color }}
                  >
                    {meta.shortName.slice(0, 2)}
                  </span>
                  <span className="provider-choice-copy">
                    <strong>{meta.name}</strong>
                    <small>{status?.connected ? 'Connected' : meta.tagline}</small>
                  </span>
                  {status?.connected && <Check size={13} className="provider-choice-check" />}
                </button>
              );
            })}
          </div>

          <p className="provider-description">{selectedMeta.description}</p>

          {ai?.providerLocked && (
            <div className="ai-env-note">
              <Lock size={15} />
              <div>
                <strong>Provider managed by your environment</strong>
                <p>
                  <code>AI_PROVIDER</code> is set to <strong>{ai.providerName}</strong>. Remove
                  that variable to switch providers here.
                </p>
              </div>
            </div>
          )}

          {selectedEnvManaged ? (
            <div className="ai-env-note">
              <Lock size={15} />
              <div>
                <strong>Key managed by your environment</strong>
                <p>
                  {selectedMeta.name} is connected with <code>{selectedMeta.envKey}</code>. Update
                  or remove that variable to rotate the key. You can still choose the model here.
                </p>
              </div>
            </div>
          ) : (
            <div className="field">
              <div className="label-row">
                <label className="label" htmlFor="ai-api-key">
                  {selectedMeta.keyLabel}
                  {!selectedMeta.keyRequired && (
                    <span className="optional-label">optional</span>
                  )}
                </label>
                {selectedMeta.docsUrl && (
                  <a
                    href={selectedMeta.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-link"
                  >
                    Get a key <ArrowRight size={10} />
                  </a>
                )}
              </div>
              <div className="secret-input">
                <KeyRound size={14} />
                <input
                  id="ai-api-key"
                  type={showKey ? 'text' : 'password'}
                  className="input"
                  placeholder={
                    selectedStatus?.connected
                      ? 'Leave blank to keep your current key'
                      : selectedMeta.keyPlaceholder
                  }
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => setShowKey((value) => !value)}
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                >
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <p className="hint">
                Your key is validated with {selectedMeta.name}, then stored only on this server. It
                is never included in browser requests after saving.
              </p>
            </div>
          )}

          <div className="ai-form-grid">
            <div className="field">
              <label className="label" htmlFor="ai-model">
                Model
              </label>
              <input
                id="ai-model"
                className="input"
                list="ai-model-options"
                placeholder={selectedMeta.defaultModel || 'your-model-name'}
                value={selectedModel}
                onChange={(event) => setSelectedModel(event.target.value)}
              />
              <datalist id="ai-model-options">
                {modelOptions.map((model) => (
                  <option value={model} key={model}>
                    {modelLabel(model)}
                  </option>
                ))}
              </datalist>
              <p className="hint">Type any model name your provider supports.</p>
            </div>

            <div className="field">
              <label className="label" htmlFor="ai-base-url">
                {selectedMeta.baseUrlLabel}
                {!selectedMeta.baseUrlRequired && (
                  <span className="optional-label">optional</span>
                )}
              </label>
              <input
                id="ai-base-url"
                className="input"
                placeholder={selectedMeta.defaultBaseUrl || 'https://your-gateway/v1'}
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="hint">{selectedMeta.baseUrlHint}</p>
            </div>
          </div>

          {selectedStatus?.connected && selectedStatus.maskedKey && (
            <div className="ai-current-key">
              <span>
                <KeyRound size={12} /> Current key
              </span>
              <code>{selectedStatus.maskedKey}</code>
              <span className="pill pill-accent">
                {selectedStatus.source === 'env' ? 'Environment' : 'Saved locally'}
              </span>
            </div>
          )}

          <div className="ai-capabilities">
            <span><Sparkles size={12} /> Caption drafts</span>
            <span><ArrowRight size={12} /> Channel adaptation</span>
            <span><Check size={12} /> Reply suggestions</span>
          </div>

          {aiError && (
            <div className="ai-modal-error">
              <span>{aiError}</span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}

function ConnectionCard({
  account,
  pending,
  disabled,
  onAction,
  onRemove,
}: {
  account: Account;
  pending: boolean;
  disabled: boolean;
  onAction: (action: ConnectionAction) => void;
  onRemove: () => void;
}) {
  const meta = PLATFORM_META[account.platform];
  const disconnected = !account.connected;
  const needsAttention = account.health === 'expiring' || account.health === 'attention';
  const statusLabel = disconnected
    ? 'Disconnected'
    : account.health === 'expiring'
      ? 'Token expiring'
      : account.health === 'attention'
        ? 'Needs attention'
        : 'Connected';

  return (
    <article
      className={`card connection-card ${disconnected ? 'connection-card-disconnected' : ''}`}
    >
      <div className="connection-card-top">
        <Avatar name={account.displayName} src="/avatars/maya.jpg" size={38} />
        <div className="connection-identity">
          <h2>
            {account.displayName}
            {account.isPrimary && <span className="connection-primary-chip">Primary</span>}
          </h2>
          <span>
            {account.handle} · {meta.name}
          </span>
        </div>
        <span
          className={`connection-health ${
            disconnected
              ? 'is-offline'
              : account.health === 'healthy'
                ? 'is-healthy'
                : 'is-warning'
          }`}
        >
          <LiveDot tone={disconnected ? 'quiet' : needsAttention ? 'warn' : 'live'} />
          {statusLabel}
        </span>
      </div>

      <p className="connection-description">{meta.description}</p>

      <div className="connection-stats">
        <div>
          <strong>{formatCompact(account.followers)}</strong>
          <span>followers</span>
        </div>
        <div>
          <strong>{account.engagementRate.toFixed(1)}%</strong>
          <span>eng. rate</span>
        </div>
        <div>
          <strong>{formatCompact(account.reach30d)}</strong>
          <span>30d reach</span>
        </div>
      </div>

      <div className="connection-scopes">
        {account.scopes.slice(0, 4).map((scope) => (
          <span key={scope}>{scope}</span>
        ))}
      </div>

      <div className="connection-foot">
        <span className="connection-sync">
          <Clock3 size={10} />
          {disconnected ? 'Not syncing' : `Synced ${formatRelative(account.lastSyncedAt)}`}
        </span>
        <div className="connection-actions">
          {disconnected || account.health === 'expiring' ? (
            <button
              className="btn btn-sm btn-accent"
              onClick={() => onAction('connect')}
              disabled={disabled || pending}
            >
              {pending ? <Spinner size={12} /> : <Plus size={12} />}
              {pending ? 'Connecting…' : 'Reconnect'}
            </button>
          ) : (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => onAction('refresh')}
              disabled={disabled || pending}
            >
              {pending ? <Spinner size={12} /> : <RefreshCw size={12} />}
              {pending ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
          {!account.isPrimary && (
            <button
              className="connection-primary"
              onClick={() => onAction('primary')}
              disabled={disabled || pending}
              title="Use this account by default for this platform"
            >
              <Star size={11} />
              Make primary
            </button>
          )}
          {!disconnected && (
            <button
              className="connection-disconnect"
              onClick={() => onAction('disconnect')}
              disabled={disabled || pending}
            >
              <Unplug size={11} />
              Disconnect
            </button>
          )}
          <button
            className="connection-remove"
            onClick={onRemove}
            disabled={disabled || pending}
            aria-label={`Remove ${account.displayName}`}
            title="Remove account"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </article>
  );
}
