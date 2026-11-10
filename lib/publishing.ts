import type { Account, Platform, Post } from './types';

export type PublishingMode = 'sandbox' | 'live';

/**
 * The active publishing transport. Reads `SOCIAL_PUBLISHING_MODE` so the
 * scheduler, API routes and UI all agree on what is live.
 */
export function getPublishingMode(): PublishingMode {
  return process.env.SOCIAL_PUBLISHING_MODE === 'live' ? 'live' : 'sandbox';
}

export interface PlatformPublishResult {
  platform: Platform;
  accountId: string;
  accountLabel: string;
  ok: boolean;
  externalId?: string;
  url?: string;
  error?: string;
}

function fallbackAccountIds(post: Post, accounts: Account[]): string[] {
  return [
    ...new Set(
      post.platforms
        .map(
          (platform) =>
            accounts.find((account) => account.platform === platform && account.isPrimary)?.id ??
            accounts.find((account) => account.platform === platform)?.id,
        )
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

/**
 * Publishing boundary for Sway.
 *
 * This demo intentionally uses the sandbox transport so that scheduling,
 * auto-publishing, content history and inbox workflows are fully testable
 * without five sets of developer credentials. Replace `publishWithSandbox`
 * with your platform adapters (or a unified publishing provider) and keep the
 * same result shape. The API and UI do not need to change.
 *
 * When `SOCIAL_PUBLISHING_MODE=live`, publishing fails loudly per account
 * until a real adapter exists — it never silently falls back to the sandbox.
 */
export async function publishPostToAccounts(
  post: Post,
  accounts: Account[],
): Promise<PlatformPublishResult[]> {
  const results: PlatformPublishResult[] = [];
  const accountIds =
    post.accountIds?.length > 0 ? post.accountIds : fallbackAccountIds(post, accounts);
  const mode = getPublishingMode();

  if (accountIds.length === 0) {
    return [
      {
        platform: post.platforms[0] ?? 'instagram',
        accountId: '',
        accountLabel: 'No account selected',
        ok: false,
        error: 'Choose at least one connected account first.',
      },
    ];
  }

  for (const accountId of accountIds) {
    const account = accounts.find((candidate) => candidate.id === accountId);
    if (!account) {
      results.push({
        platform: post.platforms[0] ?? 'instagram',
        accountId,
        accountLabel: 'Removed account',
        ok: false,
        error: 'That account is no longer connected to this workspace.',
      });
      continue;
    }
    if (!account.connected) {
      results.push({
        platform: account.platform,
        accountId: account.id,
        accountLabel: `${account.displayName} (${account.handle})`,
        ok: false,
        error: `${account.displayName} is not connected. Reconnect it and try again.`,
      });
      continue;
    }

    if (mode === 'live') {
      const adapter = liveAdapters[account.platform];
      if (!adapter) {
        results.push({
          platform: account.platform,
          accountId: account.id,
          accountLabel: `${account.displayName} (${account.handle})`,
          ok: false,
          error: `No live adapter for ${account.platform} yet. Implement it in lib/publishing.ts or set SOCIAL_PUBLISHING_MODE=sandbox.`,
        });
        continue;
      }
      results.push(await adapter(account, post));
      continue;
    }

    results.push(await publishWithSandbox(account, post));
  }

  return results;
}

/**
 * Register real platform adapters here, keyed by platform. They are only
 * used when `SOCIAL_PUBLISHING_MODE=live`; keep the `PlatformPublishResult`
 * shape and the rest of Sway keeps working.
 */
const liveAdapters: Partial<Record<Platform, typeof publishWithSandbox>> = {};

async function publishWithSandbox(
  account: Account,
  post: Post,
): Promise<PlatformPublishResult> {
  const platform = account.platform;
  const accountLabel = `${account.displayName} (${account.handle})`;
  await new Promise((resolve) => setTimeout(resolve, 160));
  const externalId = `sandbox_${account.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  // A sandbox can still validate the most important content requirements.
  if ((platform === 'instagram' || platform === 'tiktok') && post.media.length === 0) {
    return {
      platform,
      accountId: account.id,
      accountLabel,
      ok: false,
      error: `${platform} requires at least one image or video.`,
    };
  }

  return {
    platform,
    accountId: account.id,
    accountLabel,
    ok: true,
    externalId,
    url: `https://${platform}.example.com/p/${externalId}`,
  };
}
