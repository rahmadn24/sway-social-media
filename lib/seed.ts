import { randomUUID } from 'node:crypto';
import type {
  Account,
  AnalyticsPoint,
  AppNotification,
  Conversation,
  MediaAsset,
  Platform,
  Post,
} from './types';

const now = new Date();

function iso(days: number, hours = 0, minutes = 0): string {
  const d = new Date(now.getTime() + days * 86_400_000 + hours * 3_600_000 + minutes * 60_000);
  return d.toISOString();
}

function atFuture(days: number, hours: number, minutes = 0): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(hours, minutes, 0, 0);
  // If a same-day slot has already passed, move it to tomorrow.
  if (d.getTime() <= now.getTime() + 15 * 60_000) d.setDate(d.getDate() + 1);
  return d.toISOString();
}

function asset(url: string, alt: string, type: 'image' | 'video' = 'image'): MediaAsset {
  return { id: randomUUID(), url, type, alt };
}

const media = {
  autumn: asset('/images/autumn.jpg', 'Autumn wardrobe editorial'),
  studio: asset('/images/studio.jpg', 'Warm, light-filled creative studio'),
  ceramics: asset('/images/ceramics.jpg', 'Handmade ceramics collection'),
  flowers: asset('/images/flowers.jpg', 'Seasonal flowers in the studio'),
  prompts: asset('/images/prompts.jpg', 'Open notebook with creative prompts'),
  podcast: asset('/images/podcast.jpg', 'Podcast recording setup'),
  creator: asset('/images/creator.jpg', 'Creative desk with a notebook'),
  coffee: asset('/images/coffee.jpg', 'Slow morning coffee'),
  skincare: asset('/images/skincare.jpg', 'Clean beauty products'),
  fashion: asset('/images/fashion.jpg', 'Styled autumn look'),
  mountains: asset('/images/mountains.jpg', 'A quiet mountain landscape'),
  notebook: asset('/images/notebook.jpg', 'Planning a content calendar'),
};

const accounts: Account[] = [
  {
    id: 'acct_ig_maya',
    platform: 'instagram',
    connected: true,
    handle: '@maya.studio',
    displayName: 'Maya Studio',
    followers: 84_200,
    followerChange: 4.8,
    engagementRate: 5.8,
    reach30d: 121_400,
    health: 'healthy',
    lastSyncedAt: iso(0, 0, -3),
    scopes: ['posts', 'comments', 'messages', 'insights'],
    isPrimary: true,
  },
  {
    id: 'acct_ig_shop',
    platform: 'instagram',
    connected: true,
    handle: '@mayastudio.shop',
    displayName: 'Maya Studio Shop',
    followers: 12_600,
    followerChange: 6.2,
    engagementRate: 4.9,
    reach30d: 18_900,
    health: 'healthy',
    lastSyncedAt: iso(0, 0, -8),
    scopes: ['posts', 'comments', 'messages', 'insights'],
  },
  {
    id: 'acct_yt_main',
    platform: 'youtube',
    connected: true,
    handle: '@mayamakes',
    displayName: 'Maya Makes',
    followers: 61_800,
    followerChange: 2.9,
    engagementRate: 4.2,
    reach30d: 88_600,
    health: 'healthy',
    lastSyncedAt: iso(0, 0, -7),
    scopes: ['videos', 'comments', 'analytics'],
    isPrimary: true,
  },
  {
    id: 'acct_yt_shorts',
    platform: 'youtube',
    connected: true,
    handle: '@mayamakeshorts',
    displayName: 'Maya Makes Shorts',
    followers: 23_400,
    followerChange: 9.1,
    engagementRate: 6.1,
    reach30d: 41_800,
    health: 'healthy',
    lastSyncedAt: iso(0, 0, -11),
    scopes: ['videos', 'comments', 'analytics'],
  },
  {
    id: 'acct_yt_podcast',
    platform: 'youtube',
    connected: true,
    handle: '@theslowstudio',
    displayName: 'The Slow Studio',
    followers: 9_800,
    followerChange: 3.4,
    engagementRate: 3.7,
    reach30d: 14_200,
    health: 'expiring',
    lastSyncedAt: iso(0, 0, -26),
    scopes: ['videos', 'comments', 'analytics'],
  },
  {
    id: 'acct_tt_main',
    platform: 'tiktok',
    connected: true,
    handle: '@mayamakes',
    displayName: 'Maya Makes',
    followers: 57_400,
    followerChange: 8.4,
    engagementRate: 6.9,
    reach30d: 94_200,
    health: 'expiring',
    lastSyncedAt: iso(0, 0, -12),
    scopes: ['video.publish', 'comments', 'messages'],
    isPrimary: true,
  },
  {
    id: 'acct_tt_studio',
    platform: 'tiktok',
    connected: true,
    handle: '@maya.studio',
    displayName: 'Maya Studio',
    followers: 21_700,
    followerChange: 12.3,
    engagementRate: 7.8,
    reach30d: 39_400,
    health: 'healthy',
    lastSyncedAt: iso(0, 0, -6),
    scopes: ['video.publish', 'comments', 'messages'],
  },
  {
    id: 'acct_tt_clips',
    platform: 'tiktok',
    connected: true,
    handle: '@mayacliparchive',
    displayName: 'Maya Clips',
    followers: 8_300,
    followerChange: 5.6,
    engagementRate: 5.2,
    reach30d: 12_900,
    health: 'healthy',
    lastSyncedAt: iso(0, 0, -15),
    scopes: ['video.publish', 'comments'],
  },
  {
    id: 'acct_th_maya',
    platform: 'threads',
    connected: true,
    handle: '@maya.studio',
    displayName: 'Maya Studio',
    followers: 24_900,
    followerChange: 11.6,
    engagementRate: 7.4,
    reach30d: 38_600,
    health: 'healthy',
    lastSyncedAt: iso(0, 0, -4),
    scopes: ['threads', 'replies', 'insights'],
    isPrimary: true,
  },
  {
    id: 'acct_fb_maya',
    platform: 'facebook',
    connected: true,
    handle: '@mayastudio',
    displayName: 'Maya Studio',
    followers: 20_300,
    followerChange: 2.2,
    engagementRate: 3.8,
    reach30d: 27_100,
    health: 'healthy',
    lastSyncedAt: iso(0, 0, -9),
    scopes: ['pages', 'comments', 'messages', 'insights'],
    isPrimary: true,
  },
  {
    id: 'acct_fb_shop',
    platform: 'facebook',
    connected: true,
    handle: '@mayastudioshop',
    displayName: 'Maya Studio Shop',
    followers: 7_800,
    followerChange: 3.6,
    engagementRate: 4.1,
    reach30d: 11_300,
    health: 'healthy',
    lastSyncedAt: iso(0, 0, -18),
    scopes: ['pages', 'comments', 'messages', 'insights'],
  },
];

function post(
  input: Partial<Post> &
    Pick<Post, 'id' | 'caption' | 'platforms' | 'accountIds' | 'status'>,
): Post {
  const status = input.status;
  const createdAt = input.createdAt ?? iso(-3, -2);
  return {
    title: '',
    media: [],
    autoPublish: true,
    tags: [],
    aiGenerated: false,
    metrics: { impressions: 0, likes: 0, comments: 0, shares: 0, saves: 0 },
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
    ...input,
    status,
  };
}

const posts: Post[] = [
  post({
    id: 'post_01',
    title: 'The Sunday reset that actually works',
    caption:
      'The Sunday reset that actually works — no 6am alarm, no perfect planner required.\n\nJust 20 minutes, a warm drink + three tiny questions:\n\nWhat can I release from last week?\nWhat deserves my energy this week?\nWhat would make this week feel good?\n\nSave this for your next slow Sunday. 🤍\n\n#slowliving #sundayreset #creativebusiness',
    platforms: ['instagram', 'threads'],
    accountIds: ['acct_ig_maya', 'acct_th_maya'],
    media: [media.autumn],
    status: 'scheduled',
    scheduledAt: iso(0, 2, 15),
    createdAt: iso(-1, -5),
    tags: ['Lifestyle', 'Sunday'],
    aiGenerated: true,
  }),
  post({
    id: 'post_02',
    title: '3 habits that changed my creative process',
    caption:
      'Three small habits that completely changed the way I create:\n\n1. I stopped editing while I was still generating.\n2. I gave every idea a 24-hour cooling-off period.\n3. I started collecting references instead of chasing inspiration.\n\nWhich one do you need most right now? Tell me in the comments.',
    platforms: ['youtube'],
    accountIds: ['acct_yt_main'],
    media: [media.podcast],
    status: 'scheduled',
    scheduledAt: atFuture(1, 10, 0),
    createdAt: iso(-2, -3),
    tags: ['YouTube', 'Process'],
  }),
  post({
    id: 'post_03',
    title: 'Inside our autumn campaign shoot',
    caption:
      'A little look inside our autumn shoot 🍂 Warm light, vintage finds and a team that makes the long days feel easy.\n\nEverything you see was sourced from local makers — swipe through and tell me your favourite detail.',
    platforms: ['instagram', 'facebook', 'tiktok'],
    accountIds: ['acct_ig_maya', 'acct_fb_maya', 'acct_tt_main'],
    media: [media.studio, media.flowers],
    status: 'scheduled',
    scheduledAt: atFuture(2, 18, 0),
    createdAt: iso(-1, -9),
    tags: ['Behind the scenes', 'Campaign'],
  }),
  post({
    id: 'post_04',
    title: 'A gentle reminder for your week',
    caption:
      'A gentle reminder: you do not have to earn rest.\n\nYou can close the laptop. You can take the slower route. You can do less and still be exactly where you need to be.\n\nWhat does rest look like for you this week?',
    platforms: ['threads'],
    accountIds: ['acct_th_maya'],
    media: [media.mountains],
    status: 'scheduled',
    scheduledAt: atFuture(4, 9, 30),
    createdAt: iso(-3, -2),
    tags: ['Reflection', 'Community'],
  }),
  post({
    id: 'post_05',
    title: 'The new ceramics collection is here',
    caption:
      'It’s here. The first drop from our new ceramics collection — made in small batches with our favourite local studio. 🏺\n\nSoft shapes, earthy glazes and every piece just a little different. Tap through to see the whole set. We’re a tiny team and every share means the world.',
    platforms: ['instagram', 'facebook'],
    accountIds: ['acct_ig_shop', 'acct_fb_shop'],
    media: [media.ceramics, media.flowers],
    status: 'scheduled',
    scheduledAt: atFuture(5, 12, 0),
    createdAt: iso(-4, -6),
    tags: ['Launch', 'Shop'],
  }),
  post({
    id: 'post_06',
    title: 'Design a life you don’t need a vacation from',
    caption:
      'Design a life you don’t need a vacation from.\n\nNot a highlight reel. Not a 5-step framework. Just the tiny, ordinary things that make you feel like yourself.\n\nMine: morning coffee before my phone, the walk with no podcast, and saying no a little earlier.',
    platforms: ['facebook', 'threads'],
    accountIds: ['acct_fb_maya', 'acct_th_maya'],
    media: [media.mountains],
    status: 'scheduled',
    scheduledAt: atFuture(6, 17, 30),
    createdAt: iso(-5, -3),
    tags: ['Reflection'],
  }),
  post({
    id: 'post_07',
    title: 'The new ceramics collection is live',
    caption:
      'The collection is officially live. 🤍 We spent six months working with local ceramicist @clayandquiet to create 12 pieces we genuinely use every day.\n\nSwipe for a closer look at the glazes. Link in bio to shop — and thank you for supporting our tiny studio.',
    platforms: ['instagram', 'facebook'],
    accountIds: ['acct_ig_maya', 'acct_fb_maya'],
    media: [media.ceramics],
    status: 'published',
    publishedAt: iso(-1, -4),
    createdAt: iso(-6, -1),
    tags: ['Launch', 'Shop'],
    metrics: { impressions: 28_400, likes: 2_940, comments: 184, shares: 96, saves: 412 },
  }),
  post({
    id: 'post_08',
    title: 'I tried the 5AM club for 7 days',
    caption:
      'I tried the 5AM club for seven days so you don’t have to. Here’s the honest version — the good, the ridiculous, and the one change I’m keeping.\n\nSpoiler: my best ideas didn’t happen at 5am. They happened after I stopped chasing the perfect routine.',
    platforms: ['tiktok', 'youtube'],
    accountIds: ['acct_tt_main', 'acct_yt_main'],
    media: [media.fashion],
    status: 'published',
    publishedAt: iso(-3, -7),
    createdAt: iso(-8, -2),
    tags: ['Storytelling', 'Lifestyle'],
    metrics: { impressions: 84_200, likes: 7_840, comments: 421, shares: 1_028, saves: 936 },
  }),
  post({
    id: 'post_09',
    title: 'How I plan a month of content in 2 hours',
    caption:
      'The exact process I use to plan four weeks of content without burning out. No giant content bank, no 100-post backlog — just one focused session and a simple theme for each week.\n\nWant the full walkthrough? The new video is on my channel now.',
    platforms: ['facebook', 'youtube'],
    accountIds: ['acct_fb_maya', 'acct_yt_main'],
    media: [media.creator],
    status: 'published',
    publishedAt: iso(-5, -5),
    createdAt: iso(-10, -2),
    tags: ['Education', 'Workflow'],
    metrics: { impressions: 41_800, likes: 2_310, comments: 147, shares: 212, saves: 505 },
  }),
  post({
    id: 'post_10',
    title: 'The three-step evening reset',
    caption:
      'A three-step evening reset for when your brain has 47 tabs open at once:\n\n01. Clear the flat surface beside you.\n02. Write tomorrow’s one thing.\n03. Do something with your hands for ten minutes.\n\nSave this for the next time the day feels too loud.',
    platforms: ['instagram', 'tiktok'],
    accountIds: ['acct_ig_maya', 'acct_tt_main'],
    media: [media.skincare],
    status: 'published',
    publishedAt: iso(-7, -6),
    createdAt: iso(-12, -2),
    tags: ['Routine', 'Wellness'],
    metrics: { impressions: 36_900, likes: 3_120, comments: 203, shares: 340, saves: 684 },
  }),
  post({
    id: 'post_11',
    title: 'What I’d tell my 22-year-old self',
    caption:
      'What I’d tell my 22-year-old self, in six small notes.\n\n1. The work you’re proud of usually starts as the work you’re scared of.\n2. Nobody is thinking about you as much as you think.\n3. Consistency beats a perfect plan.\n4. Make things before you feel ready.\n5. Keep the friends who let you change.\n6. There is no behind. There is only your own pace.\n\nTake what you need and leave the rest.',
    platforms: ['instagram', 'threads'],
    accountIds: ['acct_ig_maya', 'acct_th_maya'],
    media: [media.notebook],
    status: 'published',
    publishedAt: iso(-10, -8),
    createdAt: iso(-15, -2),
    tags: ['Reflection'],
    metrics: { impressions: 19_800, likes: 1_660, comments: 118, shares: 72, saves: 386 },
  }),
  post({
    id: 'post_12',
    title: 'A slower Sunday, lately',
    caption:
      'A slower Sunday, lately: sourdough that didn’t rise, a long walk with no destination, and the good coffee in the tiny cup. ☕\n\nWhat’s one small thing bringing you joy this week?',
    platforms: ['instagram'],
    accountIds: ['acct_ig_maya'],
    media: [media.coffee],
    status: 'published',
    publishedAt: iso(-12, -3),
    createdAt: iso(-16, -4),
    tags: ['Slow living'],
    metrics: { impressions: 17_600, likes: 1_480, comments: 96, shares: 44, saves: 231 },
  }),
  post({
    id: 'post_13',
    title: 'The one habit that changed everything',
    caption:
      'The one habit that changed my creative output more than any tool: finishing badly, then coming back.\n\nStill working on this one. What’s a small habit that changed how you work?',
    platforms: ['threads', 'facebook'],
    accountIds: ['acct_th_maya', 'acct_fb_maya'],
    status: 'draft',
    createdAt: iso(-2, -5),
    updatedAt: iso(-1, -2),
    tags: ['Process'],
    aiGenerated: true,
  }),
  post({
    id: 'post_14',
    title: 'October favourites: 5 things I’m loving',
    caption:
      'Five things I’m loving this October: the oversized knit, the ceramic mug I use every morning, a book that made me cry, a new morning playlist, and a candle that smells like a library.\n\nWant the full list with links? Let me know and I’ll share it in stories. 🍂',
    platforms: ['instagram'],
    accountIds: ['acct_ig_shop'],
    media: [media.autumn, media.skincare, media.coffee],
    status: 'draft',
    createdAt: iso(-1, -6),
    updatedAt: iso(0, -2),
    tags: ['Favourites', 'Carousel'],
  }),
  post({
    id: 'post_15',
    title: 'My honest creative routine',
    caption:
      'My honest creative routine — the version that works on the messy days. I’m sharing the full video next week, including the tools I actually use and the ones I’ve stopped pretending to need.',
    platforms: ['youtube', 'tiktok'],
    accountIds: ['acct_yt_shorts', 'acct_tt_studio'],
    media: [media.creator],
    status: 'draft',
    createdAt: iso(0, -5),
    updatedAt: iso(0, -4),
    tags: ['Video', 'Process'],
  }),
  post({
    id: 'post_16',
    title: 'The quiet business of making things',
    caption:
      'A slower conversation for the final episode of this season: what changes when you stop measuring a creative business only by how fast it grows?\n\nWe talk about small batches, saying no, and the unglamorous systems that make the work sustainable. Listen wherever you get your podcasts.',
    platforms: ['youtube'],
    accountIds: ['acct_yt_podcast'],
    media: [media.podcast],
    status: 'scheduled',
    scheduledAt: atFuture(3, 8, 0),
    createdAt: iso(-2, -7),
    tags: ['Podcast', 'Business'],
  }),
  post({
    id: 'post_17',
    title: 'A minute inside the glaze room',
    caption:
      'Sixty seconds inside the glaze room — the weighing, the dipping, the waiting. This is the part nobody sees. 🔊 turn the sound on for the good ASMR.',
    platforms: ['tiktok', 'instagram'],
    accountIds: ['acct_tt_clips', 'acct_ig_shop'],
    media: [media.ceramics],
    status: 'scheduled',
    scheduledAt: atFuture(4, 16, 30),
    createdAt: iso(-1, -8),
    tags: ['Studio', 'Process'],
    aiGenerated: true,
  }),
];

function message(id: string, from: 'them' | 'me', text: string, minutesAgo: number) {
  return {
    id,
    from,
    text,
    createdAt: new Date(now.getTime() - minutesAgo * 60_000).toISOString(),
  };
}

const conversations: Conversation[] = [
  {
    id: 'conv_01',
    type: 'dm',
    platform: 'instagram',
    accountId: 'acct_ig_maya',
    participant: { name: 'Emma Laurent', handle: '@lune.studio', avatar: '/avatars/emma.jpg' },
    preview: 'We’d love to explore a small partnership with you…',
    unread: true,
    starred: true,
    status: 'open',
    lastMessageAt: iso(0, 0, -12),
    messages: [
      message('m01', 'them', 'Hi Maya! I’m Emma, the founder of Lune Studio. I’ve been following your work for a while — the ceramics launch was beautiful.', 46),
      message('m02', 'them', 'We’d love to explore a small partnership with you for our spring collection. No pressure, just thought we’d be a good fit. Would you be open to a quick call next week?', 12),
    ],
  },
  {
    id: 'conv_02',
    type: 'comment',
    platform: 'instagram',
    accountId: 'acct_ig_maya',
    participant: { name: 'Sophie Lin', handle: '@sophiecreates', avatar: '/avatars/sophie.jpg' },
    subject: 'The new ceramics collection is live',
    preview: 'What camera do you use for these shots? 😍',
    unread: true,
    starred: false,
    status: 'open',
    lastMessageAt: iso(0, 0, -28),
    postId: 'post_07',
    messages: [
      message('m03', 'them', 'What camera do you use for these shots? 😍 The light is unreal.', 28),
    ],
  },
  {
    id: 'conv_03',
    type: 'comment',
    platform: 'youtube',
    accountId: 'acct_yt_main',
    participant: { name: 'Creative Corner', handle: '@creativecorner', avatar: '/avatars/nia.jpg' },
    subject: 'I tried the 5AM club for 7 days',
    preview: 'Would love a part 2 on your editing workflow!',
    unread: true,
    starred: false,
    status: 'open',
    lastMessageAt: iso(0, -1, -5),
    postId: 'post_08',
    messages: [
      message('m04', 'them', 'Would love a part 2 on your editing workflow! The pacing in this one was so good.', 65),
    ],
  },
  {
    id: 'conv_04',
    type: 'comment',
    platform: 'tiktok',
    accountId: 'acct_tt_main',
    participant: { name: 'Jordan Rivera', handle: '@jordanrivera', avatar: '/avatars/jordan.jpg' },
    subject: 'I tried the 5AM club for 7 days',
    preview: 'the way I RAN to your profile after this',
    unread: true,
    starred: false,
    status: 'open',
    lastMessageAt: iso(0, -2, -10),
    postId: 'post_08',
    messages: [
      message('m05', 'them', 'the way I RAN to your profile after this. the honest version is exactly what I needed 😭', 130),
    ],
  },
  {
    id: 'conv_05',
    type: 'dm',
    platform: 'facebook',
    accountId: 'acct_fb_maya',
    participant: { name: 'Daniel Park', handle: 'Daniel Park', avatar: '/avatars/daniel.jpg' },
    preview: 'Do you ship the ceramics to the UK?',
    unread: true,
    starred: false,
    status: 'open',
    lastMessageAt: iso(0, -3, -24),
    messages: [
      message('m06', 'them', 'Hi! Do you ship the ceramics collection to the UK? I’m based in London and would love the small bud vase.', 204),
    ],
  },
  {
    id: 'conv_06',
    type: 'comment',
    platform: 'threads',
    accountId: 'acct_th_maya',
    participant: { name: 'Nia Brooks', handle: '@niabrooks', avatar: '/avatars/nia.jpg' },
    subject: 'What I’d tell my 22-year-old self',
    preview: 'This came at the exact right time. Saved 🤍',
    unread: false,
    starred: true,
    status: 'replied',
    lastMessageAt: iso(-1, -3, -15),
    postId: 'post_11',
    messages: [
      message('m07', 'them', 'This came at the exact right time. Saved 🤍', 1_760),
      message('m08', 'me', 'This made my day, Nia — thank you. Sending you a little extra courage for whatever is next. 🤍', 1_742),
      message('m09', 'them', 'Thank you Maya. Needed that more than you know.', 1_695),
    ],
  },
  {
    id: 'conv_07',
    type: 'dm',
    platform: 'tiktok',
    accountId: 'acct_tt_main',
    participant: { name: 'Aisha Khan', handle: '@aishamakes', avatar: '/avatars/aisha.jpg' },
    preview: 'Could you share the preset you used on the studio tour?',
    unread: false,
    starred: false,
    status: 'open',
    lastMessageAt: iso(-1, -6, -2),
    messages: [
      message('m10', 'them', 'Hey Maya! Could you share the preset you used on the studio tour? It’s so warm and filmic.', 1_802),
    ],
  },
  {
    id: 'conv_08',
    type: 'comment',
    platform: 'youtube',
    accountId: 'acct_yt_main',
    participant: { name: 'Mark Ellis', handle: '@markbuilds', avatar: '/avatars/jordan.jpg' },
    subject: 'How I plan a month of content in 2 hours',
    preview: 'The b-roll at 3:22 is stunning.',
    unread: false,
    starred: false,
    status: 'replied',
    lastMessageAt: iso(-2, -4, -40),
    postId: 'post_09',
    messages: [
      message('m11', 'them', 'The b-roll at 3:22 is stunning. Did you shoot that on the same day?', 3_120),
      message('m12', 'me', 'Thank you Mark! Same day, right before golden hour — we got very lucky with the light.', 3_090),
    ],
  },
  {
    id: 'conv_09',
    type: 'comment',
    platform: 'youtube',
    accountId: 'acct_yt_podcast',
    participant: { name: 'Priya Shah', handle: '@priyamakes', avatar: '/avatars/nia.jpg' },
    subject: 'The quiet business of making things',
    preview: 'The part about saying no was exactly what I needed.',
    unread: true,
    starred: false,
    status: 'open',
    lastMessageAt: iso(0, -5, -32),
    messages: [
      message('m13', 'them', 'The part about saying no was exactly what I needed. Any chance you’ll publish the full transcript?', 332),
    ],
  },
  {
    id: 'conv_10',
    type: 'dm',
    platform: 'tiktok',
    accountId: 'acct_tt_studio',
    participant: { name: 'Leo Martins', handle: '@leomakesclay', avatar: '/avatars/daniel.jpg' },
    preview: 'Would you ever run a small glazing workshop?',
    unread: true,
    starred: false,
    status: 'open',
    lastMessageAt: iso(0, -6, -18),
    messages: [
      message('m14', 'them', 'Hey! Would you ever run a small glazing workshop for a group of six? We’re a tiny ceramics collective in Lisbon.', 378),
    ],
  },
  {
    id: 'conv_11',
    type: 'dm',
    platform: 'instagram',
    accountId: 'acct_ig_shop',
    participant: { name: 'Hana Sato', handle: '@hana.interiors', avatar: '/avatars/sophie.jpg' },
    preview: 'Do you offer trade pricing for interior projects?',
    unread: false,
    starred: false,
    status: 'open',
    lastMessageAt: iso(-1, -2, -10),
    messages: [
      message('m15', 'them', 'Hi! Do you offer trade pricing for interior projects? I’m sourcing pieces for a small hotel in Kyoto.', 1_570),
    ],
  },
];

const notifications: AppNotification[] = [
  {
    id: randomUUID(),
    type: 'engagement',
    title: 'Your Reel is picking up speed',
    body: '“I tried the 5AM club for 7 days” passed 84K views on TikTok.',
    createdAt: iso(0, -1, -20),
    read: false,
    platform: 'tiktok',
  },
  {
    id: randomUUID(),
    type: 'mention',
    title: 'New comment from Sophie Lin',
    body: '“What camera do you use for these shots? 😍”',
    createdAt: iso(0, 0, -28),
    read: false,
    platform: 'instagram',
  },
  {
    id: randomUUID(),
    type: 'post',
    title: 'Post published successfully',
    body: 'The ceramics launch went live on Instagram and Facebook.',
    createdAt: iso(-1, -4),
    read: true,
    platform: 'instagram',
  },
  {
    id: randomUUID(),
    type: 'system',
    title: 'TikTok connection needs a refresh',
    body: 'Your TikTok access token expires in 3 days. Reconnect to keep auto-publishing.',
    createdAt: iso(-1, -7),
    read: true,
    platform: 'tiktok',
  },
];

function seededAnalytics(): AnalyticsPoint[] {
  const points: AnalyticsPoint[] = [];
  for (let i = 179; i >= 0; i--) {
    const date = new Date(now);
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - i);
    const t = 179 - i;
    const wave = Math.sin(t / 4.2) * 680 + Math.cos(t / 9.1) * 420;
    const weekly = [0.08, 0.02, -0.04, 0.12, 0.05, 0.16, 0.09][date.getDay()];
    const reach = Math.round(7_100 + t * 13 + wave + 7_100 * weekly);
    const engagement = Math.round(reach * (0.064 + (t / 179) * 0.012) + Math.sin(t / 2.7) * 95);
    const followers = Math.round(308_600 + t * 132 + Math.sin(t / 5) * 190);
    points.push({
      date: date.toISOString().slice(0, 10),
      reach,
      engagement,
      followers,
    });
  }
  return points;
}

// Demo workspace content, seeded into Postgres by prisma/seed.ts (and by
// POST /api/auth/reset). IDs are stable strings, so every re-seed produces
// the same workspace. The old workspace profile (Maya Chen) is not rendered
// anywhere in the UI, so it is not stored.
export const seedAccounts = accounts;
export const seedPosts = posts;
export const seedConversations = conversations;
export const seedNotifications = notifications;
export { seededAnalytics };

export type SeedPlatform = Platform;
