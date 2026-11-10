import fs from 'node:fs';
import path from 'node:path';
import {
  AI_PROVIDERS,
  AI_PROVIDER_LIST,
  DEFAULT_AI_PROVIDER,
  isAiProvider,
  modelsEndpoint,
  normalizeBaseUrl,
} from './ai-providers';
import type { AiProviderId, AiProviderStatus, AiStatus } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'ai.json');
const LEGACY_CLAUDE_FILE = path.join(DATA_DIR, 'claude.json');

interface StoredProviderSettings {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  connectedAt?: string;
}

interface StoredAiSettings {
  version?: number;
  activeProvider?: AiProviderId;
  providers?: Partial<Record<AiProviderId, StoredProviderSettings>>;
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

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readLegacyClaude(): StoredProviderSettings | null {
  try {
    if (!fs.existsSync(LEGACY_CLAUDE_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(LEGACY_CLAUDE_FILE, 'utf8')) as {
      apiKey?: string;
      model?: string;
    };
    if (!parsed.apiKey && !parsed.model) return null;
    return { apiKey: parsed.apiKey, model: parsed.model };
  } catch {
    return null;
  }
}

function readSettings(): StoredAiSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) as StoredAiSettings;
      return {
        version: parsed.version ?? 1,
        activeProvider: isAiProvider(parsed.activeProvider)
          ? parsed.activeProvider
          : DEFAULT_AI_PROVIDER,
        providers: parsed.providers ?? {},
      };
    }
  } catch {
    // Fall through to legacy migration / empty settings.
  }

  const legacy = readLegacyClaude();
  if (legacy) {
    const migrated: StoredAiSettings = {
      version: 1,
      activeProvider: 'anthropic',
      providers: { anthropic: legacy },
    };
    writeSettings(migrated);
    // The plaintext key now lives in ai.json — remove the legacy file so no
    // stale credential is left on disk after a disconnect/reset.
    try {
      fs.unlinkSync(LEGACY_CLAUDE_FILE);
    } catch {
      // Best effort; migration already succeeded.
    }
    return migrated;
  }

  return { version: 1, activeProvider: DEFAULT_AI_PROVIDER, providers: {} };
}

function writeSettings(settings: StoredAiSettings): void {
  ensureDataDir();
  const temporary = `${SETTINGS_FILE}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(settings, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  fs.renameSync(temporary, SETTINGS_FILE);
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

export function getActiveAiConfig(): ResolvedAiConfig {
  const settings = readSettings();
  return resolveProviderConfig(settings, configuredProvider(settings));
}

export function getAiStatus(): AiStatus {
  const settings = readSettings();
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
  const settings = readSettings();
  return Boolean(envApiKey(provider, configuredProvider(settings)));
}

export function saveAiSettings(input: {
  provider: AiProviderId;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}): AiStatus {
  const settings = readSettings();
  const meta = AI_PROVIDERS[input.provider];
  const current = settings.providers?.[input.provider] ?? {};
  const apiKey = input.apiKey?.trim();

  settings.providers = {
    ...settings.providers,
    [input.provider]: {
      ...current,
      apiKey: apiKey || current.apiKey,
      model: input.model?.trim() || current.model || meta.defaultModel,
      baseUrl: normalizeBaseUrl(input.baseUrl ?? current.baseUrl ?? meta.defaultBaseUrl),
      connectedAt: new Date().toISOString(),
    },
  };
  settings.activeProvider = input.provider;
  settings.version = 1;
  writeSettings(settings);
  return getAiStatus();
}

export function clearAiSettings(provider?: AiProviderId): AiStatus {
  const settings = readSettings();
  const target = provider ?? configuredProvider(settings);
  if (settings.providers?.[target]) {
    delete settings.providers[target];
    writeSettings(settings);
  }
  return getAiStatus();
}

export async function validateAiProvider(
  provider: AiProviderId,
  input: { apiKey?: string; baseUrl?: string },
): Promise<{ ok: boolean; detail?: string }> {
  const meta = AI_PROVIDERS[provider];
  const settings = readSettings();
  const key =
    input.apiKey?.trim() ||
    envApiKey(provider, configuredProvider(settings)) ||
    settings.providers?.[provider]?.apiKey?.trim();
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
