import { AI_PROVIDERS, chatEndpoint, normalizeBaseUrl } from './ai-providers';
import { getActiveAiConfig, type ResolvedAiConfig } from './ai-settings';
import { PLATFORM_META } from './platforms';
import type {
  AiGenerationInput,
  AiGenerationResult,
  AiProviderId,
  AiVariant,
  Conversation,
} from './types';

export class AiRequestError extends Error {
  status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = 'AiRequestError';
    this.status = status;
  }
}

const SYSTEM_PROMPT = `You are Sway's senior social strategist, a social media command center for a creative studio.
You write native, human social copy — never corporate, never generic, never stuffed with hashtags.
You understand the difference between a hook, a caption and a call to action.
You follow the requested tone, respect each platform's culture and length limits, and avoid making up
facts, statistics, prices, or product claims. Keep emojis intentional and sparse. Do not use hashtags
inside sentences. Never include more than 6 hashtags. Return content only in the requested format.`;

const VARIANT_SCHEMA = `{
  "variants": [
    {
      "hook": "the scroll-stopping first line",
      "caption": "the complete caption, beginning with the hook",
      "hashtags": ["#relevant", "#tags"]
    }
  ],
  "insight": "one or two sentences on which variant to lead with and why"
}`;

function buildPrompt(input: AiGenerationInput): string {
  const platforms = input.platforms
    .map(
      (platform) =>
        `${PLATFORM_META[platform].name} (${PLATFORM_META[platform].limit} character limit, ${PLATFORM_META[platform].formats})`,
    )
    .join(', ');
  const count = Math.min(Math.max(input.variantCount ?? 3, 1), 4);

  return [
    `Create ${count} distinct social media variants about the topic below.`,
    `Topic: ${input.topic}`,
    `Platforms: ${platforms || 'Instagram'}`,
    `Tone: ${input.tone}`,
    input.goal ? `Goal: ${input.goal}` : '',
    input.audience ? `Audience: ${input.audience}` : '',
    input.context ? `Extra context: ${input.context}` : '',
    '',
    'Requirements:',
    '- Each variant should use a genuinely different angle or structure.',
    '- The hook must work as the first line of the caption.',
    '- Keep every caption comfortably within the shortest selected platform limit.',
    '- Include 0–5 relevant hashtags; do not invent a branded hashtag.',
    '- Finish with an easy, specific engagement prompt when it fits the goal.',
    '- Avoid clichés like "unlock your potential", "game-changer", "dive in" and "in today’s world".',
    '- The insight should explain which variant to lead with and why, in 1–2 sentences.',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildJsonPrompt(input: AiGenerationInput): string {
  return `${buildPrompt(input)}

Return ONLY a valid JSON object with exactly this shape. Do not wrap it in markdown fences and do not add commentary.
${VARIANT_SCHEMA}`;
}

function requestError(config: ResolvedAiConfig, error: unknown): AiRequestError {
  return new AiRequestError(
    error instanceof Error
      ? `Could not reach ${config.providerName}: ${error.message}`
      : `Could not reach ${config.providerName}.`,
  );
}

function responseError(config: ResolvedAiConfig, status: number, detail?: string): AiRequestError {
  if (status === 401 || status === 403) {
    return new AiRequestError(
      detail || `${config.providerName} rejected this API key. Check it in Connections.`,
      401,
    );
  }
  return new AiRequestError(
    detail || `${config.providerName} returned ${status}.`,
    502,
  );
}

interface AnthropicContentBlock {
  type: string;
  name?: string;
  input?: unknown;
  text?: string;
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[];
  error?: { message?: string };
  model?: string;
}

async function callAnthropic(
  config: ResolvedAiConfig,
  body: Record<string, unknown>,
): Promise<AnthropicResponse> {
  const base = normalizeBaseUrl(config.baseUrl) || AI_PROVIDERS.anthropic.defaultBaseUrl;
  const url = base.endsWith('/messages') ? base : `${base}/messages`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': config.apiKey ?? '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    throw requestError(config, error);
  }

  const payload = (await response.json().catch(() => ({}))) as AnthropicResponse;
  if (!response.ok) {
    throw responseError(config, response.status, payload.error?.message);
  }
  return payload;
}

interface OpenAiResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }> | null;
      refusal?: string | null;
    };
  }>;
  error?: { message?: string };
  model?: string;
}

function openAiMessageText(payload: OpenAiResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join('\n')
      .trim();
  }
  return '';
}

async function callOpenAiCompatible(
  config: ResolvedAiConfig,
  body: Record<string, unknown>,
): Promise<OpenAiResponse> {
  const url = chatEndpoint(config.baseUrl);
  if (!url) {
    throw new AiRequestError(
      `Add the ${AI_PROVIDERS[config.provider].baseUrlLabel.toLowerCase()} for ${config.providerName}.`,
      400,
    );
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    throw requestError(config, error);
  }

  const payload = (await response.json().catch(() => ({}))) as OpenAiResponse;
  if (!response.ok) {
    throw responseError(config, response.status, payload.error?.message);
  }
  return payload;
}

function normalizeHashtags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
    .slice(0, 6);
}

function parseVariants(input: unknown): AiVariant[] {
  if (!input || typeof input !== 'object') return [];
  const variants = (input as { variants?: unknown }).variants;
  if (!Array.isArray(variants)) return [];

  return variants
    .map((variant): AiVariant | null => {
      if (!variant || typeof variant !== 'object') return null;
      const record = variant as Record<string, unknown>;
      const hook = typeof record.hook === 'string' ? record.hook.trim() : '';
      const caption = typeof record.caption === 'string' ? record.caption.trim() : '';
      if (!caption) return null;
      return {
        hook: hook || caption.split('\n')[0],
        caption,
        hashtags: normalizeHashtags(record.hashtags),
      };
    })
    .filter((variant): variant is AiVariant => Boolean(variant));
}

function insightFrom(input: unknown): string | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const value = (input as { insight?: unknown }).insight;
  return typeof value === 'string' ? value.trim() : undefined;
}

function extractJson(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

function resultFrom(
  parsed: unknown,
  config: ResolvedAiConfig,
  model?: string,
): AiGenerationResult {
  const variants = parseVariants(parsed);
  if (variants.length === 0) {
    throw new AiRequestError(
      `${config.providerName} returned an empty draft. Try a more specific topic.`,
    );
  }
  return {
    variants,
    insight:
      insightFrom(parsed) ||
      'Lead with the variant that feels most human — and adapt the hook to each channel.',
    provider: config.provider,
    providerName: config.providerName,
    model: model || config.model,
  };
}

async function generateWithAnthropic(
  config: ResolvedAiConfig,
  input: AiGenerationInput,
): Promise<AiGenerationResult> {
  const payload = await callAnthropic(config, {
    model: config.model,
    max_tokens: 2400,
    temperature: 0.8,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildPrompt(input) }],
    tools: [
      {
        name: 'draft_social_content',
        description:
          'Return ready-to-use social media drafts with hooks, captions, hashtags and a strategy note.',
        input_schema: {
          type: 'object',
          properties: {
            variants: {
              type: 'array',
              minItems: 1,
              maxItems: 4,
              items: {
                type: 'object',
                properties: {
                  hook: { type: 'string', description: 'The scroll-stopping first line.' },
                  caption: {
                    type: 'string',
                    description: 'The complete caption, beginning with the hook.',
                  },
                  hashtags: {
                    type: 'array',
                    items: { type: 'string' },
                    maxItems: 6,
                  },
                },
                required: ['hook', 'caption', 'hashtags'],
              },
            },
            insight: {
              type: 'string',
              description: 'A short recommendation about which variant to use and where.',
            },
          },
          required: ['variants', 'insight'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'draft_social_content' },
  });

  const toolUse = payload.content?.find(
    (block) => block.type === 'tool_use' && block.name === 'draft_social_content',
  );
  if (toolUse?.input) return resultFrom(toolUse.input, config, payload.model);

  const text = payload.content
    ?.filter((block) => block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n');
  if (text) {
    const parsed = extractJson(text);
    if (parsed) return resultFrom(parsed, config, payload.model);
  }

  throw new AiRequestError(
    `${config.providerName} returned an empty draft. Try a more specific topic.`,
  );
}

async function generateWithOpenAiCompatible(
  config: ResolvedAiConfig,
  input: AiGenerationInput,
): Promise<AiGenerationResult> {
  const reasoningModel =
    config.provider === 'openai' && /^o[0-9]/.test(config.model);
  const payload = await callOpenAiCompatible(config, {
    model: config.model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildJsonPrompt(input) },
    ],
    ...(reasoningModel
      ? { max_completion_tokens: 2400 }
      : { temperature: 0.8, max_tokens: 2400 }),
  });

  const text = openAiMessageText(payload);
  if (!text) {
    throw new AiRequestError(
      `${config.providerName} returned an empty draft. Try a more specific topic.`,
    );
  }
  const parsed = extractJson(text);
  if (!parsed) {
    throw new AiRequestError(
      `${config.providerName} returned a response Sway could not read. Try again.`,
    );
  }
  return resultFrom(parsed, config, payload.model);
}

export async function generateSocialContent(
  input: AiGenerationInput,
  userId: string,
): Promise<AiGenerationResult> {
  if (!input.topic?.trim()) {
    throw new AiRequestError('Add a topic or idea first.', 400);
  }

  const config = await getActiveAiConfig(userId);
  if (!config.connected) return demoGeneration(input);

  if (config.provider === 'anthropic') {
    return generateWithAnthropic(config, input);
  }
  return generateWithOpenAiCompatible(config, input);
}

function cleanTopic(topic: string): string {
  return topic
    .trim()
    .replace(/[.!?]+$/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 160);
}

function lowerFirst(value: string): string {
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function hashtagsFor(input: AiGenerationInput): string[] {
  const words = cleanTopic(input.topic)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 3)
    .slice(0, 2)
    .map((word) => `#${word}`);

  return [
    ...new Set([
      ...words,
      ...(input.platforms.includes('instagram') ? ['#creativestudio', '#behindthescenes'] : []),
      ...(input.platforms.includes('tiktok') ? ['#creatoreconomy', '#dayinthelife'] : []),
      ...(input.platforms.includes('threads') ? ['#creativecommunity'] : []),
      ...(input.platforms.includes('youtube') ? ['#creativeprocess'] : []),
      ...(input.platforms.includes('facebook') ? ['#smallbusiness'] : []),
      '#mayamakes',
    ]),
  ].slice(0, 5);
}

function ctaFor(input: AiGenerationInput): string {
  if (input.goal === 'Drive traffic') return 'There’s more of this over on the blog — link in bio if you want the longer version.';
  if (input.goal === 'Launch something new') return 'It’s live now. Tell me which one you’d choose — I’m genuinely curious.';
  if (input.goal === 'Build authority') return 'I’d love to hear how this shows up in your own process. What would you add?';
  if (input.goal === 'Build community') return 'Drop your answer below — I read every single one.';
  return 'What’s your version of this? Tell me in the comments.';
}

function demoGeneration(input: AiGenerationInput): AiGenerationResult {
  const topic = cleanTopic(input.topic);
  const tags = hashtagsFor(input);
  const cta = ctaFor(input);
  const audience = input.audience?.trim();
  const context = input.context?.trim();
  const tone = input.tone.toLowerCase();
  const topicPhrase = lowerFirst(topic);

  const contextLine = context ? `\n\n${context}` : '';
  const audienceLine = audience ? ` (especially if you're ${lowerFirst(audience)})` : '';

  const hookOne = `The honest truth about ${topicPhrase}.`;
  const hookTwo = `Three things I wish I knew about ${topicPhrase}.`;
  const hookThree = `Maybe ${topicPhrase} doesn’t need to be perfect.`;

  const opener =
    tone.includes('playful')
      ? 'Okay, let’s talk about it.'
      : tone.includes('bold')
        ? 'No sugar-coating this one.'
        : 'I’ve been sitting with this for a while.';

  const variants: AiVariant[] = [
    {
      hook: hookOne,
      caption: `${hookOne}\n\n${opener} The parts that look effortless online are usually made of tiny, unglamorous decisions${audienceLine}. The good version is the honest one.\n\n${contextLine ? `${contextLine}\n\n` : ''}${cta}\n\n${tags.join(' ')}`,
      hashtags: tags,
    },
    {
      hook: hookTwo,
      caption: `${hookTwo}\n\n01. Start before the idea feels finished.\n02. Keep one version that’s just for you.\n03. Let people see the middle, not only the result.\n\nThe messy middle is where the good stuff lives.${contextLine}\n\n${cta}\n\n${tags.slice(0, 3).join(' ')}`,
      hashtags: tags.slice(0, 3),
    },
    {
      hook: hookThree,
      caption: `${hookThree}\n\nWe spend so long trying to make everything look considered that we forget the whole point: connection.\n\nA little less polish. A little more presence. A little more of the real thing.${contextLine}\n\n${cta}\n\n${tags.slice(0, 4).join(' ')}`,
      hashtags: tags.slice(0, 4),
    },
  ];

  return {
    variants: variants.slice(0, Math.min(Math.max(input.variantCount ?? 3, 1), 3)),
    insight:
      'The list-style draft is your strongest save-worthy post, while the first one will start the most conversations. Lead with the list on carousels, then reuse the honest angle for Stories.',
    provider: 'demo',
    providerName: 'Demo writer',
    model: 'Sway demo writer',
  };
}

function demoReply(conversation: Conversation): string {
  const firstName = conversation.participant.name.split(' ')[0];
  return conversation.type === 'dm'
    ? `Hi ${firstName} — thank you so much for reaching out, this honestly made my day. I’d love to hear a little more about what you have in mind. Would a quick call next week work for you? 🤍`
    : `Thank you so much, ${firstName} — this is such a lovely note. I’m so glad it resonated. More of this is coming soon!`;
}

export async function suggestReply(
  conversation: Conversation,
  userId: string,
): Promise<{
  suggestion: string;
  provider: AiProviderId | 'demo';
  providerName: string;
  model?: string;
}> {
  const config = await getActiveAiConfig(userId);
  const firstName = conversation.participant.name.split(' ')[0];
  const transcript = conversation.messages
    .slice(-5)
    .map((message) => `${message.from === 'me' ? 'Maya' : firstName}: ${message.text}`)
    .join('\n');

  if (!config.connected) {
    return {
      suggestion: demoReply(conversation),
      provider: 'demo',
      providerName: 'Demo writer',
      model: 'Sway demo writer',
    };
  }

  const system =
    'You are Maya, a warm and thoughtful creative studio founder. Write a short reply to a social media message. Be human, specific, kind and concise. Never sound like a support bot. Do not use more than one emoji. Return only the reply text.';
  const prompt = `Channel: ${conversation.platform}\nType: ${conversation.type}\nFrom: ${conversation.participant.name} (${conversation.participant.handle})\n${conversation.subject ? `Post: ${conversation.subject}\n` : ''}Conversation:\n${transcript}\n\nWrite Maya’s next reply in under 55 words.`;

  if (config.provider === 'anthropic') {
    const payload = await callAnthropic(config, {
      model: config.model,
      max_tokens: 500,
      temperature: 0.7,
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    const text =
      payload.content
        ?.filter((block) => block.type === 'text' && typeof block.text === 'string')
        .map((block) => block.text)
        .join('\n')
        .trim() ?? '';
    if (!text) throw new AiRequestError(`${config.providerName} returned an empty reply. Try again.`);
    return {
      suggestion: text,
      provider: config.provider,
      providerName: config.providerName,
      model: payload.model ?? config.model,
    };
  }

  const reasoningModel = config.provider === 'openai' && /^o[0-9]/.test(config.model);
  const payload = await callOpenAiCompatible(config, {
    model: config.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    ...(reasoningModel
      ? { max_completion_tokens: 500 }
      : { temperature: 0.7, max_tokens: 500 }),
  });
  const text = openAiMessageText(payload);
  if (!text) throw new AiRequestError(`${config.providerName} returned an empty reply. Try again.`);
  return {
    suggestion: text,
    provider: config.provider,
    providerName: config.providerName,
    model: payload.model ?? config.model,
  };
}
