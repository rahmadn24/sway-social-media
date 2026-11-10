'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  Copy,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  SquarePen,
  WandSparkles,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type {
  AiGenerationResult,
  AiProviderId,
  AiStatus,
  AiVariant,
  Platform,
} from '@/lib/types';
import { GOALS, PLATFORM_LIST, PLATFORM_META, TONES } from '@/lib/platforms';
import { modelLabel } from '@/lib/ai-providers';
import { apiRequest } from '@/lib/client';
import { useToast } from '@/components/ToastProvider';
import {
  LiveDot,
  PageHeader,
  PlatformIcon,
  PlatformStack,
  Skeleton,
  Spinner,
} from '@/components/ui';

const STARTERS: Array<{
  label: string;
  topic: string;
  tone: string;
  goal: string;
  audience: string;
  platforms: Platform[];
}> = [
  {
    label: 'Launch story',
    topic:
      'We’re releasing a small batch of hand-thrown ceramic mugs, made in our London studio and glazed in three new colours.',
    tone: 'Warm & friendly',
    goal: 'Launch something new',
    audience: 'design-minded homeware lovers',
    platforms: ['instagram', 'threads'],
  },
  {
    label: 'Behind the scenes',
    topic:
      'What actually happens in the studio the week before a collection goes live — the failed glazes, the late nights and the tiny wins.',
    tone: 'Editorial',
    goal: 'Build community',
    audience: 'creative small business owners',
    platforms: ['instagram', 'tiktok'],
  },
  {
    label: 'Helpful list',
    topic:
      'Five small rituals that make a creative workday feel calmer, from starting before the inbox to protecting one hour for making.',
    tone: 'Educational',
    goal: 'Grow engagement',
    audience: 'freelance designers and makers',
    platforms: ['threads', 'facebook'],
  },
  {
    label: 'Founder point of view',
    topic:
      'Why we’re keeping our collection small this season instead of chasing a bigger, faster launch calendar.',
    tone: 'Bold & punchy',
    goal: 'Build authority',
    audience: 'people who care about thoughtful, slow-made design',
    platforms: ['threads', 'instagram', 'facebook'],
  },
];

interface StudioDraft {
  caption: string;
  title: string;
  platforms: Platform[];
  tone: string;
}

function captionIncludesTags(variant: AiVariant): boolean {
  if (variant.hashtags.length === 0) return true;
  const caption = variant.caption.toLowerCase();
  return variant.hashtags.every((tag) => caption.includes(tag.toLowerCase()));
}

function fullCaption(variant: AiVariant): string {
  if (captionIncludesTags(variant)) return variant.caption;
  return `${variant.caption}\n\n${variant.hashtags.join(' ')}`;
}

function titleFromHook(hook: string): string {
  if (hook.length <= 80) return hook;
  const cut = hook.slice(0, 77);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : 77)}…`;
}

export default function StudioPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [ai, setAi] = useState<AiStatus | null>(null);
  const [topic, setTopic] = useState('');
  const [tone, setTone] = useState<string>('Warm & friendly');
  const [goal, setGoal] = useState<string>('Grow engagement');
  const [audience, setAudience] = useState('Design-minded creative entrepreneurs');
  const [context, setContext] = useState('');
  const [platforms, setPlatforms] = useState<Platform[]>(['instagram', 'threads']);

  const [variants, setVariants] = useState<AiVariant[]>([]);
  const [insight, setInsight] = useState('');
  const [provider, setProvider] = useState<AiProviderId | 'demo' | null>(null);
  const [providerLabel, setProviderLabel] = useState('Demo writer');
  const [resultModel, setResultModel] = useState<string | undefined>(undefined);
  const [lastBrief, setLastBrief] = useState<{ platforms: Platform[]; topic: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    apiRequest<AiStatus>('/api/ai/settings')
      .then(setAi)
      .catch(() => undefined);
  }, []);

  const activePlatforms = lastBrief?.platforms ?? platforms;
  const shortestPlatform = activePlatforms.reduce<Platform>(
    (shortest, platform) =>
      PLATFORM_META[platform].limit < PLATFORM_META[shortest].limit ? platform : shortest,
    activePlatforms[0] ?? 'instagram',
  );
  const minLimit = PLATFORM_META[shortestPlatform].limit;
  const connected = Boolean(ai?.connected);
  const activeProvider = ai?.providerName ?? 'your AI provider';
  const activeWriter =
    provider === 'demo'
      ? 'Demo writer'
      : provider
        ? providerLabel
        : activeProvider;

  function togglePlatform(platform: Platform) {
    setPlatforms((current) => {
      if (current.includes(platform)) {
        if (current.length === 1) {
          toast('Keep at least one channel in the brief.', 'info');
          return current;
        }
        return current.filter((item) => item !== platform);
      }
      return [...current, platform];
    });
  }

  async function generate(contextOverride?: string) {
    const cleanedTopic = topic.trim();
    if (!cleanedTopic) {
      toast('Give the AI a topic or idea first.', 'error');
      return;
    }

    const nextContext = contextOverride ?? context;
    setLoading(true);
    try {
      const result = await apiRequest<AiGenerationResult>('/api/ai/generate', {
        method: 'POST',
        body: JSON.stringify({
          topic: cleanedTopic,
          platforms,
          tone,
          goal,
          audience: audience.trim() || undefined,
          context: nextContext.trim() || undefined,
          variantCount: 3,
        }),
      });
      setVariants(result.variants);
      setInsight(result.insight);
      setProvider(result.provider);
      setProviderLabel(result.providerName);
      setResultModel(result.model);
      setLastBrief({ platforms: [...platforms], topic: cleanedTopic });
      toast(
        result.provider === 'demo'
          ? 'Three demo drafts are ready.'
          : `${result.providerName} wrote three new drafts.`,
      );
      if (window.matchMedia('(max-width: 1120px)').matches) {
        window.setTimeout(() => {
          document.querySelector('.studio-results')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }, 80);
      }
    } catch (reason) {
      toast(
        reason instanceof Error ? reason.message : 'The AI provider could not write that draft.',
        'error',
      );
    } finally {
      setLoading(false);
    }
  }

  function refine(instruction: string) {
    const next = context.trim()
      ? `${context.trim()}\nRefinement: ${instruction}`
      : `Refinement: ${instruction}`;
    setContext(next);
    void generate(next);
  }

  function loadStarter(starter: (typeof STARTERS)[number]) {
    setTopic(starter.topic);
    setTone(starter.tone);
    setGoal(starter.goal);
    setAudience(starter.audience);
    setPlatforms(starter.platforms);
    setContext('');
    setVariants([]);
    setInsight('');
    setProvider(null);
    setProviderLabel('Demo writer');
    setLastBrief(null);
    toast('Brief loaded. Add your own spin — or generate straight away.', 'info');
  }

  async function copyVariant(variant: AiVariant) {
    try {
      await navigator.clipboard.writeText(fullCaption(variant));
      toast('Draft copied to your clipboard.');
    } catch {
      toast('Copy failed. Select the draft text manually.', 'error');
    }
  }

  function sendToComposer(variant: AiVariant) {
    const draft: StudioDraft = {
      caption: fullCaption(variant),
      title: titleFromHook(variant.hook),
      platforms: lastBrief?.platforms ?? platforms,
      tone,
    };
    try {
      window.sessionStorage.setItem('sway:studio-draft', JSON.stringify(draft));
      router.push('/composer?from=studio');
    } catch {
      toast('Could not open the composer. Copy the draft instead.', 'error');
    }
  }

  return (
    <div className="studio-page">
      <PageHeader
        eyebrow={
          <>
            AI Studio
            <span className="eyebrow-dot" />
            {ai === null ? 'Checking provider' : connected ? `${ai.providerName} connected` : 'Demo writer'}
          </>
        }
        title={
          <>
            A rough idea, <em>beautifully said</em>.
          </>
        }
        subtitle="Give the AI the spark. Get native drafts for every channel, shaped around your voice and ready for the composer."
        actions={
          <>
            <Link href="/composer" className="btn btn-secondary">
              <SquarePen size={14} />
              Open composer
            </Link>
            <Link href="/connections#ai" className="btn btn-primary">
              <Sparkles size={14} />
              {connected ? 'Manage AI provider' : 'Connect AI'}
            </Link>
          </>
        }
      />

      <div className="studio-status-strip">
        <span className="studio-status-item">
          <span className="studio-status-orb">
            <Sparkles size={14} />
          </span>
          <LiveDot tone={connected ? 'live' : 'quiet'} />
          <strong>{connected ? `${ai?.providerName} is ready` : 'Demo writer is on'}</strong>
          <span className="studio-status-model">
            {connected ? modelLabel(ai?.model) : 'No key connected'}
          </span>
        </span>
        <span className="studio-status-item">
          <WandSparkles size={12} />
          <strong>{platforms.length}</strong> channel{platforms.length === 1 ? '' : 's'} in this brief
        </span>
        <span className="studio-status-note">
          <ShieldCheck size={11} />
          {connected
            ? `Only the brief you write here is sent to ${ai?.providerName}.`
            : 'Connect an AI provider for drafts written in your own voice.'}
        </span>
      </div>

      <div className="studio-layout">
        <section className="card studio-controls-card" aria-label="Creative brief">
          <div className="studio-controls-head">
            <span className="studio-controls-orb">
              <WandSparkles size={16} />
            </span>
            <div>
              <h2>Creative brief</h2>
              <p>The more context, the more it sounds like you.</p>
            </div>
          </div>

          <div className="field studio-field">
            <div className="label-row">
              <label className="label" htmlFor="studio-topic">
                The idea
              </label>
              <span className="studio-count">{topic.length.toLocaleString()} / 600</span>
            </div>
            <textarea
              id="studio-topic"
              className="input studio-topic"
              rows={4}
              maxLength={600}
              placeholder="A sentence is enough. What do you want to say?"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
            />
            <p className="hint">The AI will find the angle, hook and call to action.</p>
          </div>

          <div className="field studio-field">
            <span className="label">Tone of voice</span>
            <div className="studio-chips">
              {TONES.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`studio-chip ${tone === option ? 'is-active' : ''}`}
                  onClick={() => setTone(option)}
                  aria-pressed={tone === option}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="studio-two-col">
            <div className="field">
              <label className="label" htmlFor="studio-goal">
                Goal
              </label>
              <select
                id="studio-goal"
                className="select"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
              >
                {GOALS.map((option) => (
                  <option value={option} key={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label" htmlFor="studio-audience">
                Audience
              </label>
              <input
                id="studio-audience"
                className="input"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                placeholder="Who is this for?"
              />
            </div>
          </div>

          <div className="field studio-field">
            <div className="label-row">
              <span className="label">Channels</span>
              <span className="hint">{platforms.length} selected</span>
            </div>
            <div className="studio-platform-grid">
              {PLATFORM_LIST.map((meta) => {
                const selected = platforms.includes(meta.id);
                return (
                  <button
                    key={meta.id}
                    type="button"
                    className={`studio-platform ${selected ? 'is-active' : ''}`}
                    onClick={() => togglePlatform(meta.id)}
                    aria-pressed={selected}
                    title={meta.formats}
                  >
                    <PlatformIcon platform={meta.id} size={10} badge />
                    <span>{meta.name}</span>
                    <span className="studio-platform-check">
                      <Check size={9} strokeWidth={3} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="field studio-field">
            <label className="label" htmlFor="studio-context">
              Anything else?
            </label>
            <textarea
              id="studio-context"
              className="input studio-context"
              rows={2}
              placeholder="A story, an offer, a phrase you love, something to avoid…"
              value={context}
              onChange={(event) => setContext(event.target.value)}
            />
          </div>

          <button
            className="btn btn-accent btn-lg studio-generate"
            onClick={() => void generate()}
            disabled={loading}
          >
            {loading ? <Spinner size={15} /> : <Sparkles size={15} />}
            {loading ? 'Writing…' : variants.length ? 'Write another set' : 'Generate drafts'}
          </button>
          <p className="studio-generate-note">
            {connected ? (
              <>Drafting with {modelLabel(ai?.model)} on {ai?.providerName}. You stay in control of the final edit.</>
            ) : (
              <>
                Demo writer active.{' '}
                <Link href="/connections#ai">Connect an AI provider</Link> for drafts in your voice.
              </>
            )}
          </p>
        </section>

        <section className="studio-results" aria-label="Generated drafts">
          <div className="studio-results-head">
            <div>
              <h2>{variants.length ? (loading ? 'Writing a fresh set' : 'Your drafts') : 'The canvas'}</h2>
              <p>
                {variants.length && lastBrief
                  ? `Written for ${lastBrief.platforms
                      .map((platform) => PLATFORM_META[platform].name)
                      .join(', ')}.`
                  : 'Everything the AI writes will land here, ready to shape.'}
              </p>
            </div>
            {provider && (
              <span className={`studio-provider ${provider !== 'demo' ? 'is-claude' : 'is-demo'}`}>
                <Sparkles size={11} />
                {provider === 'demo' ? 'Demo writer' : `${providerLabel} · ${modelLabel(resultModel)}`}
              </span>
            )}
          </div>

          {loading && variants.length > 0 && (
            <div className="studio-writing-bar">
              <Spinner size={12} />
              {activeWriter} is shaping another set around your brief…
            </div>
          )}

          {loading && variants.length === 0 ? (
            <StudioLoading />
          ) : variants.length > 0 ? (
            <>
              {provider === 'demo' && (
                <div className="studio-demo-banner">
                  <Sparkles size={13} />
                  <span>
                    These are demo drafts. <Link href="/connections#ai">Connect an AI provider</Link> to
                    write with your real context and voice.
                  </span>
                </div>
              )}

              {variants.map((variant, index) => {
                const caption = fullCaption(variant);
                const overLimit = caption.length > minLimit;
                return (
                  <article className="card studio-variant" key={`${variant.hook}-${index}`}>
                    <header className="studio-variant-head">
                      <span className="studio-variant-index">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span className="studio-variant-label">Option {index + 1}</span>
                      <PlatformStack platforms={activePlatforms} size={8} />
                      <span className="studio-variant-chars">
                        {caption.length.toLocaleString()} chars
                      </span>
                    </header>

                    <p className="studio-variant-caption">{variant.caption}</p>

                    {!captionIncludesTags(variant) && (
                      <div className="studio-variant-hashtags">
                        {variant.hashtags.map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    )}

                    <footer className="studio-variant-foot">
                      <span className={`studio-limit ${overLimit ? 'is-over' : ''}`}>
                        {overLimit ? <AlertCircle size={11} /> : <Check size={11} />}
                        {overLimit
                          ? `Trim ${(caption.length - minLimit).toLocaleString()} characters for ${
                              PLATFORM_META[shortestPlatform].name
                            }`
                          : `Fits all ${activePlatforms.length} selected channel${
                              activePlatforms.length === 1 ? '' : 's'
                            }`}
                      </span>
                      <div className="studio-variant-actions">
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => void copyVariant(variant)}
                        >
                          <Copy size={12} />
                          Copy
                        </button>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => sendToComposer(variant)}
                        >
                          <SquarePen size={12} />
                          Use in composer
                        </button>
                      </div>
                    </footer>
                  </article>
                );
              })}

              <div className="studio-insight">
                <span className="studio-insight-icon">
                  <Lightbulb size={16} />
                </span>
                <div>
                  <p className="studio-insight-eyebrow">Strategist’s note</p>
                  <p>{insight}</p>
                </div>
              </div>

              <div className="studio-refine">
                <span>
                  <WandSparkles size={11} />
                  Keep shaping it
                </span>
                <button
                  type="button"
                  onClick={() => refine('Make it shorter and more direct, without losing the warmth.')}
                  disabled={loading}
                >
                  Shorter
                </button>
                <button
                  type="button"
                  onClick={() => refine('Make it more personal and specific, as if I’m telling one person.')}
                  disabled={loading}
                >
                  More personal
                </button>
                <button
                  type="button"
                  onClick={() => refine('Add a stronger, more specific call to action at the end.')}
                  disabled={loading}
                >
                  Stronger CTA
                </button>
                <button
                  type="button"
                  onClick={() => refine('Give it a bolder, more confident opening line.')}
                  disabled={loading}
                >
                  Bolder hook
                </button>
              </div>
            </>
          ) : (
            <div className="card studio-empty">
              <span className="studio-empty-orb">
                <Sparkles size={23} />
              </span>
              <p className="studio-empty-eyebrow">Your canvas is ready</p>
              <h3>
                Give the AI <em>a spark</em>.
              </h3>
              <p className="studio-empty-copy">
                Describe the idea in your own words. The AI will turn it into three distinct
                drafts — a hook, a caption and the right hashtags — written for the channels you
                choose.
              </p>
              <div className="studio-starters">
                {STARTERS.map((starter) => (
                  <button
                    type="button"
                    className="studio-starter"
                    key={starter.label}
                    onClick={() => loadStarter(starter)}
                  >
                    <span>{starter.label}</span>
                    <strong>{starter.topic}</strong>
                  </button>
                ))}
              </div>
              <span className="studio-empty-note">
                <ShieldCheck size={11} />
                Nothing is published until you send it to the composer.
              </span>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function StudioLoading() {
  return (
    <div className="studio-loading" aria-live="polite" aria-label="The AI is writing">
      {[0, 1].map((index) => (
        <div className="studio-loading-card" key={index}>
          <div className="studio-loading-head">
            <Skeleton style={{ width: 22, height: 21, borderRadius: 5 }} />
            <Skeleton style={{ width: 72, height: 8 }} />
            <span style={{ marginLeft: 'auto' }}>
              <Spinner size={13} />
            </span>
          </div>
          <div className="studio-loading-lines">
            <Skeleton style={{ width: '96%', height: 10 }} />
            <Skeleton style={{ width: '88%', height: 10 }} />
            <Skeleton style={{ width: '92%', height: 10 }} />
            <Skeleton style={{ width: '58%', height: 10 }} />
          </div>
        </div>
      ))}
      <p className="studio-generate-note">
        Reading the brief, finding the angle, writing like a human…
      </p>
    </div>
  );
}
