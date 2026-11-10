import { AI_PROVIDER_IDS } from './types';
import type { AiProviderId } from './types';

export interface AiProviderMeta {
  id: AiProviderId;
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  kind: 'anthropic' | 'openai';
  color: string;
  softColor: string;
  keyLabel: string;
  keyPlaceholder: string;
  keyRequired: boolean;
  defaultModel: string;
  models: string[];
  defaultBaseUrl: string;
  baseUrlRequired: boolean;
  baseUrlLabel: string;
  baseUrlHint: string;
  envKey: string;
  envModel: string;
  envBaseUrl?: string;
  docsUrl: string;
}

export const AI_PROVIDERS: Record<AiProviderId, AiProviderMeta> = {
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    shortName: 'Claude',
    tagline: 'Claude models',
    description: 'Thoughtful, high-quality writing with strong tone control.',
    kind: 'anthropic',
    color: '#C96F4A',
    softColor: '#FBF0E9',
    keyLabel: 'Anthropic API key',
    keyPlaceholder: 'sk-ant-api03-…',
    keyRequired: true,
    defaultModel: 'claude-sonnet-4-5-20250929',
    models: [
      'claude-sonnet-4-5-20250929',
      'claude-haiku-4-5-20251001',
      'claude-opus-4-1-20250805',
    ],
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    baseUrlRequired: false,
    baseUrlLabel: 'API base URL',
    baseUrlHint: 'Change only if you use an Anthropic-compatible gateway.',
    envKey: 'ANTHROPIC_API_KEY',
    envModel: 'CLAUDE_MODEL',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    shortName: 'OpenAI',
    tagline: 'GPT models',
    description: 'Fast, versatile drafting with a huge model lineup.',
    kind: 'openai',
    color: '#0D8A72',
    softColor: '#E8F5F1',
    keyLabel: 'OpenAI API key',
    keyPlaceholder: 'sk-proj-…',
    keyRequired: true,
    defaultModel: 'gpt-4.1-mini',
    models: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini', 'gpt-4o', 'o4-mini'],
    defaultBaseUrl: 'https://api.openai.com/v1',
    baseUrlRequired: false,
    baseUrlLabel: 'API base URL',
    baseUrlHint: 'Works with OpenAI or an OpenAI-compatible proxy.',
    envKey: 'OPENAI_API_KEY',
    envModel: 'OPENAI_MODEL',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    shortName: 'Gemini',
    tagline: 'Gemini models',
    description: 'Long context and quick, affordable multimodal drafts.',
    kind: 'openai',
    color: '#3F6FD8',
    softColor: '#EBF0FC',
    keyLabel: 'Google AI API key',
    keyPlaceholder: 'AIza…',
    keyRequired: true,
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.0-flash'],
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    baseUrlRequired: false,
    baseUrlLabel: 'API base URL',
    baseUrlHint: 'Uses Google’s OpenAI-compatible endpoint.',
    envKey: 'GEMINI_API_KEY',
    envModel: 'GEMINI_MODEL',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    shortName: 'Groq',
    tagline: 'Ultra-fast inference',
    description: 'Low-latency open models — great for quick caption remixes.',
    kind: 'openai',
    color: '#D9542B',
    softColor: '#FBEEE8',
    keyLabel: 'Groq API key',
    keyPlaceholder: 'gsk_…',
    keyRequired: true,
    defaultModel: 'llama-3.3-70b-versatile',
    models: [
      'llama-3.3-70b-versatile',
      'llama-3.1-8b-instant',
      'openai/gpt-oss-120b',
      'openai/gpt-oss-20b',
    ],
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    baseUrlRequired: false,
    baseUrlLabel: 'API base URL',
    baseUrlHint: 'Groq’s OpenAI-compatible endpoint.',
    envKey: 'GROQ_API_KEY',
    envModel: 'GROQ_MODEL',
    docsUrl: 'https://console.groq.com/keys',
  },
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    shortName: 'OpenRouter',
    tagline: 'Many models, one key',
    description: 'Route to Claude, GPT, Gemini, Llama and more with one key.',
    kind: 'openai',
    color: '#7B5CD6',
    softColor: '#F1EDFC',
    keyLabel: 'OpenRouter API key',
    keyPlaceholder: 'sk-or-v1-…',
    keyRequired: true,
    defaultModel: 'openai/gpt-4.1-mini',
    models: [
      'openai/gpt-4.1-mini',
      'anthropic/claude-sonnet-4.5',
      'google/gemini-2.5-flash',
      'meta-llama/llama-3.3-70b-instruct',
    ],
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    baseUrlRequired: false,
    baseUrlLabel: 'API base URL',
    baseUrlHint: 'OpenRouter’s OpenAI-compatible endpoint.',
    envKey: 'OPENROUTER_API_KEY',
    envModel: 'OPENROUTER_MODEL',
    docsUrl: 'https://openrouter.ai/keys',
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    shortName: 'DeepSeek',
    tagline: 'Cost-effective reasoning',
    description: 'Strong writing and reasoning at a very low cost per token.',
    kind: 'openai',
    color: '#2F6FEB',
    softColor: '#EAF1FE',
    keyLabel: 'DeepSeek API key',
    keyPlaceholder: 'sk-…',
    keyRequired: true,
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    baseUrlRequired: false,
    baseUrlLabel: 'API base URL',
    baseUrlHint: 'DeepSeek’s OpenAI-compatible endpoint.',
    envKey: 'DEEPSEEK_API_KEY',
    envModel: 'DEEPSEEK_MODEL',
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  ollama: {
    id: 'ollama',
    name: 'Ollama',
    shortName: 'Ollama',
    tagline: 'Local & private',
    description: 'Run open models on your own machine. Nothing leaves your network.',
    kind: 'openai',
    color: '#4B5563',
    softColor: '#F0F1F3',
    keyLabel: 'API key (optional)',
    keyPlaceholder: 'Leave blank for local Ollama',
    keyRequired: false,
    defaultModel: 'llama3.2',
    models: ['llama3.2', 'qwen2.5', 'mistral', 'llama3.1:8b'],
    defaultBaseUrl: 'http://localhost:11434/v1',
    baseUrlRequired: false,
    baseUrlLabel: 'Ollama base URL',
    baseUrlHint: 'The OpenAI-compatible endpoint exposed by Ollama.',
    envKey: 'OLLAMA_API_KEY',
    envModel: 'OLLAMA_MODEL',
    envBaseUrl: 'OLLAMA_BASE_URL',
    docsUrl: 'https://ollama.com/download',
  },
  custom: {
    id: 'custom',
    name: 'Custom endpoint',
    shortName: 'Custom',
    tagline: 'Any OpenAI-compatible API',
    description: 'Azure, vLLM, LM Studio, LiteLLM or your own gateway.',
    kind: 'openai',
    color: '#5E6B4F',
    softColor: '#F1F4EC',
    keyLabel: 'API key (optional)',
    keyPlaceholder: 'Your endpoint key',
    keyRequired: false,
    defaultModel: '',
    models: [],
    defaultBaseUrl: '',
    baseUrlRequired: true,
    baseUrlLabel: 'Base URL',
    baseUrlHint: 'Include the version path, e.g. https://your-gateway/v1.',
    envKey: 'CUSTOM_AI_API_KEY',
    envModel: 'CUSTOM_AI_MODEL',
    envBaseUrl: 'CUSTOM_AI_BASE_URL',
    docsUrl: '',
  },
};

export const AI_PROVIDER_LIST = AI_PROVIDER_IDS.map((id) => AI_PROVIDERS[id]);

export const DEFAULT_AI_PROVIDER: AiProviderId = 'anthropic';

const MODEL_LABELS: Record<string, string> = {
  'claude-sonnet-4-5-20250929': 'Claude Sonnet 4.5',
  'claude-haiku-4-5-20251001': 'Claude Haiku 4.5',
  'claude-opus-4-1-20250805': 'Claude Opus 4.1',
  'gpt-4.1-mini': 'GPT-4.1 mini',
  'gpt-4.1': 'GPT-4.1',
  'gpt-4o-mini': 'GPT-4o mini',
  'gpt-4o': 'GPT-4o',
  'o4-mini': 'o4-mini',
  'gemini-2.5-flash': 'Gemini 2.5 Flash',
  'gemini-2.5-pro': 'Gemini 2.5 Pro',
  'gemini-2.0-flash': 'Gemini 2.0 Flash',
  'llama-3.3-70b-versatile': 'Llama 3.3 70B',
  'llama-3.1-8b-instant': 'Llama 3.1 8B',
  'deepseek-chat': 'DeepSeek Chat',
  'deepseek-reasoner': 'DeepSeek Reasoner',
  'openai/gpt-4.1-mini': 'GPT-4.1 mini (OpenRouter)',
  'anthropic/claude-sonnet-4.5': 'Claude Sonnet 4.5 (OpenRouter)',
  'google/gemini-2.5-flash': 'Gemini 2.5 Flash (OpenRouter)',
};

export function modelLabel(model: string | undefined): string {
  if (!model) return 'No model yet';
  return MODEL_LABELS[model] ?? model;
}

export function isAiProvider(value: unknown): value is AiProviderId {
  return typeof value === 'string' && AI_PROVIDER_IDS.includes(value as AiProviderId);
}

export function providerName(id: AiProviderId | 'demo'): string {
  return id === 'demo' ? 'Demo writer' : AI_PROVIDERS[id].name;
}

export function normalizeBaseUrl(value: string | undefined | null): string {
  return (value ?? '').trim().replace(/\/+$/, '');
}

export function chatEndpoint(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return '';
  if (base.endsWith('/chat/completions')) return base;
  return `${base}/chat/completions`;
}

export function modelsEndpoint(baseUrl: string): string {
  const base = normalizeBaseUrl(baseUrl);
  if (!base) return '';
  if (base.endsWith('/chat/completions')) return base.replace(/\/chat\/completions$/, '/models');
  return `${base}/models`;
}
