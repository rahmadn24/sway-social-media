import { NextRequest, NextResponse } from 'next/server';
import {
  AI_PROVIDERS,
  isAiProvider,
  normalizeBaseUrl,
} from '@/lib/ai-providers';
import {
  clearAiSettings,
  getAiStatus,
  providerHasEnvKey,
  saveAiSettings,
  validateAiProvider,
} from '@/lib/ai-settings';
import type { AiProviderId } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(getAiStatus());
}

export async function PUT(request: NextRequest) {
  let body: {
    provider?: string;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }

  const status = getAiStatus();
  const provider: AiProviderId = isAiProvider(body.provider) ? body.provider : status.provider;

  if (status.providerLocked && provider !== status.provider) {
    return NextResponse.json(
      { error: 'The AI provider is managed by AI_PROVIDER in the environment.' },
      { status: 400 },
    );
  }

  const meta = AI_PROVIDERS[provider];
  const providerStatus = status.providers.find((entry) => entry.id === provider);
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : undefined;
  const model = typeof body.model === 'string' ? body.model.trim() : undefined;
  const requestedBaseUrl =
    typeof body.baseUrl === 'string' ? body.baseUrl.trim() : undefined;
  const baseUrl = normalizeBaseUrl(
    requestedBaseUrl || providerStatus?.baseUrl || meta.defaultBaseUrl,
  );

  if (model && model.length > 160) {
    return NextResponse.json({ error: 'That model name is too long.' }, { status: 400 });
  }
  if (meta.baseUrlRequired && !baseUrl) {
    return NextResponse.json(
      { error: `Enter the ${meta.baseUrlLabel.toLowerCase()} for ${meta.name}.` },
      { status: 400 },
    );
  }
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    return NextResponse.json(
      { error: 'The base URL must start with http:// or https://.' },
      { status: 400 },
    );
  }

  if (apiKey && providerHasEnvKey(provider)) {
    return NextResponse.json(
      { error: `This key is managed by ${meta.envKey} in the environment.` },
      { status: 400 },
    );
  }

  if (!apiKey && meta.keyRequired && !providerStatus?.connected) {
    return NextResponse.json({ error: `Enter your ${meta.name} API key.` }, { status: 400 });
  }

  if (apiKey || requestedBaseUrl !== undefined) {
    const validation = await validateAiProvider(provider, {
      apiKey,
      baseUrl,
    });
    if (!validation.ok) {
      return NextResponse.json(
        { error: `We couldn’t connect to ${meta.name}.`, detail: validation.detail },
        { status: 400 },
      );
    }
  }

  return NextResponse.json(
    saveAiSettings({
      provider,
      apiKey,
      model: model || providerStatus?.model,
      baseUrl,
    }),
  );
}

export async function DELETE(request: NextRequest) {
  const requested = request.nextUrl.searchParams.get('provider');
  if (requested && !isAiProvider(requested)) {
    return NextResponse.json({ error: 'Unknown AI provider.' }, { status: 400 });
  }
  const status = getAiStatus();
  if (status.providerLocked && requested && requested !== status.provider) {
    return NextResponse.json(
      { error: 'The AI provider is managed by AI_PROVIDER in the environment.' },
      { status: 400 },
    );
  }
  return NextResponse.json(
    clearAiSettings(requested && isAiProvider(requested) ? requested : undefined),
  );
}
