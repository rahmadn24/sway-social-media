export const PLATFORMS = [
  'instagram',
  'youtube',
  'tiktok',
  'threads',
  'facebook',
] as const;

export type Platform = (typeof PLATFORMS)[number];

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed';
export type AccountHealth = 'healthy' | 'expiring' | 'attention';
export type InboxType = 'dm' | 'comment';

export interface Account {
  id: string;
  platform: Platform;
  connected: boolean;
  handle: string;
  displayName: string;
  followers: number;
  followerChange: number;
  engagementRate: number;
  reach30d: number;
  health: AccountHealth;
  lastSyncedAt: string;
  scopes: string[];
  isPrimary?: boolean;
}

export interface MediaAsset {
  id: string;
  url: string;
  type: 'image' | 'video';
  alt?: string;
}

export interface PostMetrics {
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface Post {
  id: string;
  title?: string;
  caption: string;
  platforms: Platform[];
  accountIds: string[];
  media: MediaAsset[];
  status: PostStatus;
  scheduledAt?: string;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  autoPublish: boolean;
  metrics: PostMetrics;
  tags: string[];
  aiGenerated: boolean;
  overrides?: Partial<Record<Platform, string>>;
}

export interface ConversationMessage {
  id: string;
  from: 'them' | 'me';
  text: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  type: InboxType;
  platform: Platform;
  accountId: string;
  participant: {
    name: string;
    handle: string;
    avatar?: string;
  };
  subject?: string;
  preview: string;
  unread: boolean;
  starred: boolean;
  status: 'open' | 'replied' | 'resolved';
  lastMessageAt: string;
  messages: ConversationMessage[];
  postId?: string;
}

export interface AppNotification {
  id: string;
  type: 'engagement' | 'system' | 'mention' | 'post';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  platform?: Platform;
  accountId?: string;
}

export interface AnalyticsPoint {
  date: string;
  reach: number;
  engagement: number;
  followers: number;
}

export interface OverviewMetrics {
  reach: number;
  reachChange: number;
  engagement: number;
  engagementChange: number;
  followers: number;
  followersChange: number;
  engagementRate: number;
}

export interface OverviewData {
  metrics: OverviewMetrics;
  chart: AnalyticsPoint[];
  scheduledCount: number;
  unreadCount: number;
  accounts: Account[];
  upcoming: Post[];
  inbox: Conversation[];
  topPosts: Post[];
}

export interface AnalyticsTotals {
  reach: number;
  reachChange: number;
  engagement: number;
  engagementChange: number;
  followers: number;
  followersChange: number;
  engagementRate: number;
  publishedCount: number;
  avgPostReach: number;
  netFollowers: number;
}

export interface PlatformPerformance {
  platform: Platform;
  accounts: number;
  followers: number;
  followerChange: number;
  engagementRate: number;
  reach: number;
  impressions: number;
  posts: number;
  engagement: number;
  share: number;
}

export interface AccountPerformance {
  accountId: string;
  platform: Platform;
  displayName: string;
  handle: string;
  connected: boolean;
  followers: number;
  followerChange: number;
  engagementRate: number;
  reach: number;
  impressions: number;
  posts: number;
  engagement: number;
  share: number;
}

export interface AudienceSlice {
  label: string;
  value: number;
}

export interface AudienceData {
  age: AudienceSlice[];
  gender: AudienceSlice[];
  locations: AudienceSlice[];
  activeHours: number[];
}

export interface HeatmapCell {
  day: string;
  slot: string;
  value: number;
}

export interface FormatPerformance {
  label: string;
  posts: number;
  reach: number;
  engagementRate: number;
}

export interface AnalyticsData {
  range: '7d' | '30d' | '90d';
  totals: AnalyticsTotals;
  chart: AnalyticsPoint[];
  platforms: PlatformPerformance[];
  accounts: AccountPerformance[];
  audience: AudienceData;
  topPosts: Post[];
  heatmap: HeatmapCell[];
  bestDay: string;
  bestHour: string;
  formats: FormatPerformance[];
}

export const AI_PROVIDER_IDS = [
  'anthropic',
  'openai',
  'gemini',
  'groq',
  'openrouter',
  'deepseek',
  'ollama',
  'custom',
] as const;

export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

export interface AiGenerationInput {
  topic: string;
  platforms: Platform[];
  tone: string;
  goal?: string;
  audience?: string;
  context?: string;
  variantCount?: number;
}

export interface AiVariant {
  hook: string;
  caption: string;
  hashtags: string[];
}

export interface AiGenerationResult {
  variants: AiVariant[];
  insight: string;
  provider: AiProviderId | 'demo';
  providerName: string;
  model?: string;
}

export interface AiProviderStatus {
  id: AiProviderId;
  name: string;
  connected: boolean;
  source: 'env' | 'local' | null;
  maskedKey: string | null;
  model: string;
  baseUrl: string;
  keyRequired: boolean;
}

export interface AiStatus {
  provider: AiProviderId;
  providerName: string;
  connected: boolean;
  source: 'env' | 'local' | null;
  maskedKey: string | null;
  model: string;
  baseUrl: string;
  availableModels: string[];
  demoMode: boolean;
  envManaged: boolean;
  providerLocked: boolean;
  providers: AiProviderStatus[];
}

export interface ApiError {
  error: string;
  detail?: string;
}
