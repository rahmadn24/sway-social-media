import { NextRequest, NextResponse } from 'next/server';
import { AiRequestError, generateSocialContent } from '@/lib/ai';
import { getAuthenticatedUser } from '@/lib/session';
import { PLATFORMS } from '@/lib/types';
import type { AiGenerationInput, Platform } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized. Sign in to continue.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Send a valid JSON body.' }, { status: 400 });
  }

  const platforms = Array.isArray(body.platforms)
    ? (body.platforms.filter((platform): platform is Platform =>
        PLATFORMS.includes(platform as Platform),
      ) as Platform[])
    : [];

  const input: AiGenerationInput = {
    topic: typeof body.topic === 'string' ? body.topic : '',
    platforms: platforms.length ? platforms : ['instagram'],
    tone: typeof body.tone === 'string' ? body.tone : 'Warm & friendly',
    goal: typeof body.goal === 'string' ? body.goal : undefined,
    audience: typeof body.audience === 'string' ? body.audience : undefined,
    context: typeof body.context === 'string' ? body.context : undefined,
    variantCount: typeof body.variantCount === 'number' ? body.variantCount : 3,
  };

  try {
    const result = await generateSocialContent(input, user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AiRequestError) {
      return NextResponse.json(
        {
          error:
            error.status === 400 ? error.message : 'The AI provider couldn’t finish that draft.',
          detail: error.message,
        },
        { status: error.status },
      );
    }
    return NextResponse.json(
      {
        error: 'The AI provider couldn’t finish that draft.',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 502 },
    );
  }
}
