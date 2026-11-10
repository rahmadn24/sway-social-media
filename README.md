# Sway — Social Studio

Sway is an AI-powered social media command center for **Instagram, YouTube, TikTok, Threads and Facebook**. It brings planning, composing, scheduling, publishing, comments and DMs into one calm workspace, with your AI writing partner alongside you.

The app runs locally as a full-stack Next.js project. It needs no platform credentials to explore: scheduling, auto-publishing, analytics and the unified inbox run against a local demo workspace, while AI generation connects to a real provider — Anthropic, OpenAI, Google, Groq, OpenRouter, DeepSeek, Ollama or any OpenAI-compatible endpoint — when you add a key.

## What's inside

| Area | What you can do |
| --- | --- |
| **Overview** | See reach, engagement, follower growth, today's queue, recent conversations and winning content at a glance. |
| **Claude Studio** | Turn a rough idea into three channel-aware drafts with hooks, captions, hashtags and a strategy note. Send any draft straight to the composer. |
| **Composer** | Write once, select channels, tailor captions per channel, upload media, choose a schedule, and publish immediately or automatically. |
| **Content** | Search and filter drafts, scheduled, published and failed posts. Open a post, duplicate it, edit it or delete it. |
| **Calendar** | Review the month, inspect the queue, and give undated drafts a publishing slot straight from the "Waiting for a date" list. |
| **Inbox** | Read comments and DMs from all five channels, filter by type or platform, reply, star, resolve and ask your AI for a reply suggestion. |
| **Analytics** | Explore 7/30/90-day performance, audience mix, active hours, a best-time heatmap, format insights and a CSV export. |
| **Connections** | Check channel health, reconnect or refresh accounts, review the publishing boundary and connect an AI provider. |

## Stack

- **Next.js 16.4.5** (App Router, Turbopack)
- **React 19** and **TypeScript**
- **lucide-react** icons and **date-fns**
- A hand-built CSS design system in `app/globals.css`
- JSON persistence in `data/store.json` — no external database required
- Bring-your-own-key AI: Anthropic, OpenAI, Google, Groq, OpenRouter, DeepSeek, Ollama or any OpenAI-compatible endpoint (falls back to a labeled demo writer when no key is present)
- A background scheduler started through `instrumentation.ts`

## Getting started

Requirements: **Node.js 20+** and npm.

```bash
cd sway-social-studio
npm install
npm run dev
```

Open <http://localhost:3000>.

For a production check:

```bash
npm run build
npm start
```

On first start, Sway seeds a local workspace in `data/store.json` and downloads nothing at runtime — the demo images and avatars live in `public/`.

## Environment variables

Copy the example file if you want to configure anything:

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | No | Active provider: `anthropic`, `openai`, `gemini`, `groq`, `openrouter`, `deepseek`, `ollama` or `custom`. Defaults to `anthropic`. |
| `AI_API_KEY` | No | Generic key for the active provider. Each provider also honors its own variable (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `OLLAMA_API_KEY`, `CUSTOM_AI_API_KEY`). |
| `AI_MODEL` / `AI_BASE_URL` | No | Override the model or endpoint (needed for `custom`). Per-provider defaults are built in. |
| `SOCIAL_PUBLISHING_MODE` | No | `sandbox` (default) or `live`. In `live`, publishing calls the adapters registered in `lib/publishing.ts` and fails loudly for platforms that have none — it never falls back to the sandbox. |

Keys are validated against the provider before they are stored, and are never sent back to the browser.

If no key is present, Sway uses a high-quality demo writer and labels every generated result as **Demo writer** so the difference is always visible.

## Connecting an AI provider

There are two supported paths:

1. **Through the UI** — go to **Connections → Connect AI** and paste your provider key. Sway validates the key, stores it server-side in `data/ai.json` with local-only file permissions, and never sends the key back to the browser. (A legacy `data/claude.json` from earlier builds is migrated on first read and deleted.)
2. **Through the environment** — set `AI_PROVIDER` and the matching key variable in `.env.local`. In this mode the key is managed by the environment and the UI only lets you choose the model.

The active provider powers:

- **Studio drafts** — `POST /api/ai/generate`
- **Inbox reply suggestions** — `POST /api/ai/reply`

## Publishing: sandbox by default

Sway currently ships with a **sandbox publishing transport** in `lib/publishing.ts`. It validates a post (caption, selected channels, required media for Instagram/TikTok), simulates platform results, and lets the full scheduling and auto-publish loop be tested safely. No content is sent to a social network.

The scheduler runs every 20 seconds and publishes due posts where `autoPublish` is enabled. Results are written back to `data/store.json` and surfaced in notifications and the content library.

To add real publishing:

1. Create developer apps for each network and add OAuth credentials to your environment.
2. Register an adapter per platform in the `liveAdapters` map in `lib/publishing.ts`, keeping the `PlatformPublishResult` return shape.
3. Set `SOCIAL_PUBLISHING_MODE=live`.
4. Reconnect accounts through **Connections**.

In `live` mode Sway never silently falls back to the sandbox: a platform without a registered adapter returns an explicit per-account error, so a misconfiguration is visible immediately instead of publishing fakes.

The API routes, composer, calendar, scheduler and UI do not need to change.

## Data and reset

- Workspace data: `data/store.json`
- AI provider credentials: `data/ai.json` (created only after you connect a key)
- Uploaded media: `public/uploads/`

Both `data/` and `public/uploads/` are gitignored. To return to the seeded demo workspace, stop the server, delete `data/store.json` (and `data/ai.json` if you want to disconnect your provider), then start it again.

The app is intentionally single-workspace and file-backed. It is designed as a complete local product demo, not a multi-tenant production deployment.

## Project structure

```text
app/
  page.tsx                 Overview
  studio/                  Claude Studio
  composer/                Post composer
  content/                 Content library
  calendar/                Content calendar
  inbox/                   Unified comments and DMs
  analytics/               Analytics dashboard
  connections/             Channel + AI provider connections
  api/                     Route handlers for posts, conversations,
                           analytics, AI, connections, upload, notifications
components/
  AppShell.tsx             Sidebar, topbar, command palette, notifications
  ui.tsx                   Shared UI primitives
  PerformanceChart.tsx     Custom SVG chart + sparkline
  MediaThumb.tsx           Media thumbnails
  ToastProvider.tsx        Toast system
lib/
  seed.ts                  Seeded demo workspace
  store.ts                 JSON persistence
  publishing.ts            Publishing boundary / mode switch / adapters
  scheduler.ts             Auto-publish loop
  ai.ts                    Prompts, demo fallback, reply suggestions
  ai-providers.ts          Provider registry (Anthropic, OpenAI, Gemini, …)
  ai-settings.ts           Key validation and local storage (data/ai.json)
  accounts.ts              Account helpers
  platforms.ts             Platform metadata and limits
  analytics.ts             Analytics aggregation
  overview.ts              Dashboard aggregation
  client.ts                Shared fetch helpers and refresh events
  format.ts                Number/date formatting
  types.ts                 Shared models
data/                      Local JSON data (gitignored)
public/                    Images, avatars, uploads
```

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/overview` | Dashboard summary |
| `GET` | `/api/analytics?range=7d\|30d\|90d` | Analytics aggregation |
| `GET/POST` | `/api/posts` | List or create posts |
| `GET/PATCH/DELETE` | `/api/posts/[id]` | Read, update or delete a post |
| `POST` | `/api/posts/[id]/publish` | Publish a post now |
| `POST` | `/api/posts/[id]/duplicate` | Duplicate a post |
| `GET` | `/api/conversations` | Unified inbox |
| `PATCH` | `/api/conversations/[id]` | Mark read, star, resolve |
| `POST` | `/api/conversations/[id]/reply` | Send a reply |
| `GET/POST` | `/api/connections` | Channel status, publishing mode, add a sandbox account |
| `PATCH` | `/api/connections/[id]` | Connect, disconnect, refresh or set primary |
| `DELETE` | `/api/connections/[id]` | Remove an account (reassigns related content) |
| `POST` | `/api/ai/generate` | Generate social drafts |
| `POST` | `/api/ai/reply` | Suggest an inbox reply |
| `GET/PUT/DELETE` | `/api/ai/settings` | AI provider connection and model |
| `POST` | `/api/upload` | Upload media |
| `GET` | `/api/notifications` | Read notifications |
| `PATCH` | `/api/notifications` | Mark notifications read |

## Notes

- The demo workspace uses seeded analytics and inbox data. Comments, DMs, and analytics are not fetched from live networks yet.
- Real platform publishing and inbox sync require platform developer credentials and OAuth flows. The adapter boundary and connection UI are ready for them.
- AI output is a draft, not an autopilot: review the copy, check channel limits in the composer, and choose when to publish.
- `next dev` may regenerate `AGENTS.md`; this is expected Next.js 16 behavior.
