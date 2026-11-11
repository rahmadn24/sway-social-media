import { decryptApiKey, encryptApiKey } from './crypto';
import { prisma } from './prisma';
import {
  AI_PROVIDERS,
  AI_PROVIDER_LIST,
  DEFAULT_AI_PROVIDER,
  isAiProvider,
  modelsEndpoint,
  normalizeBaseUrl,
} from './ai-providers';
import type { AiProviderId, AiProviderStatus, AiStatus } from './types';

// AI provider settings, per signed-in user, stored in Postgres.
// Provider keys are AES-256-GCM encrypted at rest (lib/crypto.ts) and are
// NEVER returned by any API response — only a masked preview is exposed.
//
// Resolution order for a key (unchanged from before):
//   1. environment variable for that provider (env-managed, UI cannot override)
//   2. the signed-in user's encrypted key in the database
// The active provider is per user, unless AI_PROVIDER is set in the
// environment (providerLocked).

interface StoredProviderSettings {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  connectedAt?: string;
}

interface StoredAiSettings {
  activeProvider: AiProviderId;
  providers: Partial<Record<AiProviderId, StoredProviderSettings>>;
}

export interface ResolvedAiConfig {
  provider: AiProviderId;
  providerName: string;
  apiKey?: string;
  model: string;
  baseUrl: string;
  connected: boolean;
  source: 'env' | 'local' | null;
  envManaged: boolean;
}

async function readUserSettings(userId: string): Promise<StoredAiSettings> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { aiSettings: true },
  });
  const providers: StoredAiSettings['providers'] = {};
  if (user) {
    for (const row of user.aiSettings) {
      if (!isAiProvider(row.provider)) continue;
      providers[row.provider] = {
        apiKey: row.encryptedApiKey
          ? (decryptApiKey(row.encryptedApiKey) ?? undefined)
          : undefined,
        model: row.model ?? undefined,
        baseUrl: row.baseUrl ?? undefined,
        connectedAt: row.connectedAt?.toISOString(),
      };
    }
  }
  return {
    activeProvider:
      user && isAiProvider(user.activeAiProvider)
        ? user.activeAiProvider
        : DEFAULT_AI_PROVIDER,
    providers,
  };
}

function configuredProvider(settings: StoredAiSettings): AiProviderId {
  const fromEnv = process.env.AI_PROVIDER?.trim();
  if (isAiProvider(fromEnv)) return fromEnv;
  if (isAiProvider(settings.activeProvider)) return settings.activeProvider;
  return DEFAULT_AI_PROVIDER;
}

function envApiKey(provider: AiProviderId, active: AiProviderId): string | undefined {
  if (provider === active) {
    const generic = process.env.AI_API_KEY?.trim();
    if (generic) return generic;
  }
  const meta = AI_PROVIDERS[provider];
  return process.env[meta.envKey]?.trim() || undefined;
}

function envModel(provider: AiProviderId, active: AiProviderId): string | undefined {
  if (provider === active) {
    const generic = process.env.AI_MODEL?.trim();
    if (generic) return generic;
  }
  const meta = AI_PROVIDERS[provider];
  return process.env[meta.envModel]?.trim() || undefined;
}

function envBaseUrl(provider: AiProviderId, active: AiProviderId): string | undefined {
  if (provider === active) {
    const generic = process.env.AI_BASE_URL?.trim();
    if (generic) return generic;
  }
  const meta = AI_PROVIDERS[provider];
  if (meta.envBaseUrl) {
    const value = process.env[meta.envBaseUrl]?.trim();
    if (value) return value;
  }
  if (provider === 'anthropic') {
    return process.env.ANTHROPIC_BASE_URL?.trim() || undefined;
  }
  return undefined;
}

function resolveProviderConfig(
  settings: StoredAiSettings,
  provider: AiProviderId,
): ResolvedAiConfig {
  const meta = AI_PROVIDERS[provider];
  const active = configuredProvider(settings);
  const local = settings.providers?.[provider] ?? {};
  const envKeyValue = envApiKey(provider, active);
  const key = envKeyValue ?? local.apiKey?.trim();
  const source: 'env' | 'local' | null = envKeyValue
    ? 'env'
    : local.apiKey?.trim()
      ? 'local'
      : null;
  const model = envModel(provider, active) ?? local.model?.trim() ?? meta.defaultModel;
  const baseUrl = normalizeBaseUrl(
    envBaseUrl(provider, active) ?? local.baseUrl ?? meta.defaultBaseUrl,
  );

  const keyReady = meta.keyRequired ? Boolean(key) : true;
  const baseReady = meta.baseUrlRequired ? Boolean(baseUrl) : true;
  const modelReady = Boolean(model);

  return {
    provider,
    providerName: meta.name,
    apiKey: key,
    model,
    baseUrl,
    connected: keyReady && baseReady && modelReady,
    source,
    envManaged: source === 'env',
  };
}

export async function getActiveAiConfig(userId: string): Promise<ResolvedAiConfig> {
  const settings = await readUserSettings(userId);
  return resolveProviderConfig(settings, configuredProvider(settings));
}

export async function getAiStatus(userId: string): Promise<AiStatus> {
  const settings = await readUserSettings(userId);
  const provider = configuredProvider(settings);
  const active = resolveProviderConfig(settings, provider);

  const providers: AiProviderStatus[] = AI_PROVIDER_LIST.map((meta) => {
    const resolved = resolveProviderConfig(settings, meta.id);
    return {
      id: meta.id,
      name: meta.name,
      connected: resolved.connected,
      source: resolved.source,
      maskedKey: resolved.apiKey ? maskKey(resolved.apiKey) : null,
      model: resolved.model,
      baseUrl: resolved.baseUrl,
      keyRequired: meta.keyRequired,
    };
  });

  return {
    provider,
    providerName: active.providerName,
    connected: active.connected,
    source: active.source,
    maskedKey: active.apiKey ? maskKey(active.apiKey) : null,
    model: active.model,
    baseUrl: active.baseUrl,
    availableModels: AI_PROVIDERS[provider].models,
    demoMode: !active.connected,
    envManaged: active.source === 'env',
    providerLocked: Boolean(process.env.AI_PROVIDER?.trim()),
    providers,
  };
}

export function maskKey(key: string): string {
  if (key.length <= 10) return '••••••••';
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

export function providerHasEnvKey(provider: AiProviderId): boolean {
  const active = process.env.AI_PROVIDER?.trim();
  return Boolean(envApiKey(provider, isAiProvider(active) ? active : DEFAULT_AI_PROVIDER));
}

export async function saveAiSettings(
  userId: string,
  input: {
    provider: AiProviderId;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  },
): Promise<AiStatus> {
  const meta = AI_PROVIDERS[input.provider];
  const existing = await prisma.aiSetting.findUnique({
    where: { userId_provider: { userId, provider: input.provider } },
  });
  const apiKey = input.apiKey?.trim();

  await prisma.aiSetting.upsert({
    where: { userId_provider: { userId, provider: input.provider } },
    update: {
      encryptedApiKey: apiKey
        ? encryptApiKey(apiKey)
        : (existing?.encryptedApiKey ?? null),
      model: input.model?.trim() || existing?.model || meta.defaultModel,
      baseUrl: normalizeBaseUrl(input.baseUrl ?? existing?.baseUrl ?? meta.defaultBaseUrl),
      connectedAt: new Date(),
    },
    create: {
      userId,
      provider: input.provider,
      encryptedApiKey: apiKey ? encryptApiKey(apiKey) : null,
      model: input.model?.trim() || meta.defaultModel,
      baseUrl: normalizeBaseUrl(input.baseUrl ?? meta.defaultBaseUrl),
      connectedAt: new Date(),
    },
  });

  // The chosen provider becomes this user's active provider.
  await prisma.user.update({
    where: { id: userId },
    data: { activeAiProvider: input.provider },
  });

  return getAiStatus(userId);
}

export async function clearAiSettings(
  userId: string,
  provider?: AiProviderId,
): Promise<AiStatus> {
  const settings = await readUserSettings(userId);
  const target = provider ?? configuredProvider(settings);
  await prisma.aiSetting.deleteMany({ where: { userId, provider: target } });
  return getAiStatus(userId);
}

export async function validateAiProvider(
  provider: AiProviderId,
  input: { apiKey?: string; baseUrl?: string },
  userId?: string,
): Promise<{ ok: boolean; detail?: string }> {
  const meta = AI_PROVIDERS[provider];
  const settings = userId ? await readUserSettings(userId) : null;
  const key =
    input.apiKey?.trim() ||
    envApiKey(provider, settings ? configuredProvider(settings) : DEFAULT_AI_PROVIDER) ||
    settings?.providers?.[provider]?.apiKey?.trim();
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? meta.defaultBaseUrl);

  if (meta.keyRequired && !key) {
    return { ok: false, detail: `Enter your ${meta.name} API key first.` };
  }
  if (meta.baseUrlRequired && !baseUrl) {
    return { ok: false, detail: `Enter the ${meta.baseUrlLabel.toLowerCase()} first.` };
  }

  if (provider === 'anthropic') {
    const url = `${normalizeBaseUrl(baseUrl) || meta.defaultBaseUrl}/models?limit=1`;
    try {
      const response = await fetch(url, {
        headers: {
          'x-api-key': key ?? '',
          'anthropic-version': '2023-06-01',
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return { ok: true };
      if (response.status === 401 || response.status === 403) {
        return { ok: false, detail: `That API key was not accepted by ${meta.name}.` };
      }
      const text = await response.text().catch(() => '');
      return {
        ok: false,
        detail: text.slice(0, 240) || `${meta.name} returned ${response.status}.`,
      };
    } catch (error) {
      return {
        ok: false,
        detail:
          error instanceof Error
            ? `Could not reach ${meta.name}: ${error.message}`
            : `Could not reach ${meta.name}.`,
      };
    }
  }

  const url = modelsEndpoint(baseUrl);
  try {
    const response = await fetch(url, {
      headers: key ? { authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) return { ok: true };
    if (response.status === 401 || response.status === 403) {
      return { ok: false, detail: `That API key was not accepted by ${meta.name}.` };
    }
    // Many OpenAI-compatible gateways do not expose /models. If the key was
    // accepted and the endpoint simply lacks the route, keep the configuration.
    if (response.status === 404) {
      return { ok: true, detail: 'Saved — this endpoint does not expose a model list.' };
    }
    if (response.status === 429) {
      return { ok: true, detail: 'Saved — the provider is rate limiting model discovery.' };
    }
    const text = await response.text().catch(() => '');
    return {
      ok: false,
      detail: text.slice(0, 240) || `${meta.name} returned ${response.status}.`,
    };
  } catch (error) {
    return {
      ok: false,
      detail:
        error instanceof Error
          ? `Could not reach ${meta.name} at ${baseUrl}: ${error.message}`
          : `Could not reach ${meta.name} at ${baseUrl}.`,
    };
  }
}
