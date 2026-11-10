import type { Platform } from './types';

export interface PlatformMeta {
  id: Platform;
  name: string;
  shortName: string;
  description: string;
  color: string;
  softColor: string;
  handleLabel: string;
  limit: number;
  formats: string;
  inboxNote: string;
}

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  instagram: {
    id: 'instagram',
    name: 'Instagram',
    shortName: 'IG',
    description: 'Feed posts, Reels and carousels',
    color: '#E1306C',
    softColor: '#FCEAF1',
    handleLabel: 'username',
    limit: 2200,
    formats: 'Image, carousel, Reel',
    inboxNote: 'Comments & DMs',
  },
  youtube: {
    id: 'youtube',
    name: 'YouTube',
    shortName: 'YT',
    description: 'Long-form videos and Shorts',
    color: '#FF0033',
    softColor: '#FFECEC',
    handleLabel: 'channel',
    limit: 5000,
    formats: 'Video, Short',
    inboxNote: 'Comments',
  },
  tiktok: {
    id: 'tiktok',
    name: 'TikTok',
    shortName: 'TT',
    description: 'Short-form video and photo posts',
    color: '#111111',
    softColor: '#EFEFEF',
    handleLabel: 'username',
    limit: 2200,
    formats: 'Video, photo carousel',
    inboxNote: 'Comments & DMs',
  },
  threads: {
    id: 'threads',
    name: 'Threads',
    shortName: 'TH',
    description: 'Conversations and quick updates',
    color: '#111111',
    softColor: '#F0EFEA',
    handleLabel: 'username',
    limit: 500,
    formats: 'Text, image, video',
    inboxNote: 'Replies',
  },
  facebook: {
    id: 'facebook',
    name: 'Facebook',
    shortName: 'FB',
    description: 'Page updates and community posts',
    color: '#1877F2',
    softColor: '#EAF2FF',
    handleLabel: 'page',
    limit: 63206,
    formats: 'Text, image, video, link',
    inboxNote: 'Comments & DMs',
  },
};

export const PLATFORM_LIST = Object.values(PLATFORM_META);

export const TONES = [
  'Warm & friendly',
  'Bold & punchy',
  'Editorial',
  'Playful',
  'Educational',
  'Inspiring',
] as const;

export const GOALS = [
  'Grow engagement',
  'Build authority',
  'Drive traffic',
  'Launch something new',
  'Build community',
] as const;
