import { PLATFORMS } from './types';
import type { Account, Platform } from './types';

export function accountsForPlatform(accounts: Account[], platform: Platform): Account[] {
  return accounts.filter((account) => account.platform === platform);
}

export function primaryAccount(
  accounts: Account[],
  platform: Platform,
): Account | undefined {
  const candidates = accountsForPlatform(accounts, platform);
  return candidates.find((account) => account.isPrimary) ?? candidates[0];
}

/**
 * Keep account selection and platform selection in sync.
 *
 * New clients send `accountIds`. Older data (or a quick API call) may only send
 * `platforms`, so we fall back to that platform's primary account. This keeps the
 * multi-account model backward compatible with the original single-account seed.
 */
export function resolveAccountIds(
  accounts: Account[],
  input: { accountIds?: unknown; platforms?: unknown },
): string[] {
  const validIds = new Set(accounts.map((account) => account.id));
  const explicit = Array.isArray(input.accountIds)
    ? input.accountIds.filter(
        (value): value is string => typeof value === 'string' && validIds.has(value),
      )
    : [];

  if (explicit.length > 0) return [...new Set(explicit)];

  const platforms = Array.isArray(input.platforms)
    ? input.platforms.filter((value): value is Platform =>
        PLATFORMS.includes(value as Platform),
      )
    : [];

  return [
    ...new Set(
      platforms
        .map((platform) => primaryAccount(accounts, platform)?.id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
}

export function platformsForAccountIds(accounts: Account[], accountIds: string[]): Platform[] {
  const selected = new Set(accountIds);
  const platforms = new Set(
    accounts
      .filter((account) => selected.has(account.id))
      .map((account) => account.platform),
  );
  return PLATFORMS.filter((platform) => platforms.has(platform));
}

export function resolveAccounts(accounts: Account[], accountIds: string[]): Account[] {
  const selected = new Set(accountIds);
  return accounts.filter((account) => selected.has(account.id));
}

export function accountName(account: Account): string {
  return account.displayName || account.handle;
}

export function accountsSummary(accounts: Account[], accountIds: string[]): string {
  const selected = resolveAccounts(accounts, accountIds);
  if (selected.length === 0) return 'No accounts';
  const platforms = new Set(selected.map((account) => account.platform)).size;
  if (selected.length === 1) return `${accountName(selected[0])} · ${selected[0].handle}`;
  return `${selected.length} accounts across ${platforms} platform${platforms === 1 ? '' : 's'}`;
}

export function groupAccountsByPlatform(
  accounts: Account[],
): Array<{ platform: Platform; accounts: Account[] }> {
  return PLATFORMS.map((platform) => ({
    platform,
    accounts: accountsForPlatform(accounts, platform),
  })).filter((group) => group.accounts.length > 0);
}
