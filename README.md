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
- **Postgres + Prisma** — every piece of structured data (users, AI keys
  encrypted at rest, accounts, posts, conversations, notifications,
  analytics) lives in Postgres; see `prisma/schema.prisma`. No JSON store.
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

On first start, Sway applies pending Prisma migrations and seeds the demo
workspace (and the demo + admin users) into Postgres, then downloads
nothing at runtime — the demo images and avatars live in `public/`.

## Environment variables

Copy the example file if you want to configure anything:

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Postgres connection string, e.g. `postgresql://sway:…@localhost:5432/sway`. |
| `SWAY_SESSION_SECRET` | Yes (production) | Secret that signs session cookies. Generate one with `openssl rand -hex 32`. Production refuses to start without it; development uses a random per-boot secret and warns. |
| `SWAY_ENCRYPTION_KEY` | Yes (production) | 64 hex chars (32 bytes, `openssl rand -hex 32`) for AES-256-GCM encryption of per-user AI keys at rest. Production refuses to start without it. Losing it makes stored AI keys unreadable. |
| `SWAY_ADMIN_EMAIL` / `SWAY_ADMIN_PASSWORD` | No | Seed-only: when both are set, the seed creates/updates the admin user (scrypt-hashed, never stored in plaintext). The demo user is created by the seed with a random password nobody knows. |
| `AI_PROVIDER` | No | Active provider: `anthropic`, `openai`, `gemini`, `groq`, `openrouter`, `deepseek`, `ollama` or `custom`. Defaults to `anthropic`. |
| `AI_API_KEY` | No | Generic key for the active provider. Each provider also honors its own variable (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `DEEPSEEK_API_KEY`, `OLLAMA_API_KEY`, `CUSTOM_AI_API_KEY`). |
| `AI_MODEL` / `AI_BASE_URL` | No | Override the model or endpoint (needed for `custom`). Per-provider defaults are built in. |
| `SOCIAL_PUBLISHING_MODE` | No | `sandbox` (default) or `live`. In `live`, publishing calls the adapters registered in `lib/publishing.ts` and fails loudly for platforms that have none — it never falls back to the sandbox. |

Sign-in: the app has two accounts sharing one workspace. The demo account is
entered with the **"Try the demo"** button on the login page (no password is
shown or needed); the admin account is the one seeded above. Sessions last
7 days.

Keys are validated against the provider before they are stored, and are never sent back to the browser.

If no key is present, Sway uses a high-quality demo writer and labels every generated result as **Demo writer** so the difference is always visible.

## Connecting an AI provider

There are two supported paths:

1. **Through the UI** — go to **Connections → Connect AI** and paste your provider key. Sway validates the key, stores it encrypted per user in Postgres (AES-256-GCM, `SWAY_ENCRYPTION_KEY`), and never sends the key back to the browser.
2. **Through the environment** — set `AI_PROVIDER` and the matching key variable in `.env.local`. In this mode the key is managed by the environment and the UI only lets you choose the model.

The active provider powers:

- **Studio drafts** — `POST /api/ai/generate`
- **Inbox reply suggestions** — `POST /api/ai/reply`

## Publishing: sandbox by default

Sway currently ships with a **sandbox publishing transport** in `lib/publishing.ts`. It validates a post (caption, selected channels, required media for Instagram/TikTok), simulates platform results, and lets the full scheduling and auto-publish loop be tested safely. No content is sent to a social network.

The scheduler runs every 20 seconds and publishes due posts where `autoPublish` is enabled. Results are written back to Postgres and surfaced in notifications and the content library.

To add real publishing:

1. Create developer apps for each network and add OAuth credentials to your environment.
2. Register an adapter per platform in the `liveAdapters` map in `lib/publishing.ts`, keeping the `PlatformPublishResult` return shape.
3. Set `SOCIAL_PUBLISHING_MODE=live`.
4. Reconnect accounts through **Connections**.

In `live` mode Sway never silently falls back to the sandbox: a platform without a registered adapter returns an explicit per-account error, so a misconfiguration is visible immediately instead of publishing fakes.

The API routes, composer, calendar, scheduler and UI do not need to change.

## Data and reset

- Workspace data (accounts, posts, conversations, notifications,
  analytics): Postgres, schema in `prisma/schema.prisma`
- Users + AI provider credentials (encrypted per user): Postgres
- Uploaded media: `public/uploads/`

`public/uploads/` is gitignored. To return to the seeded demo workspace,
call **POST /api/auth/reset** while signed in (or run `npx prisma db seed`
after truncating the content tables) — it truncates the workspace content
tables and re-seeds the demo content. Users and their AI settings are
never touched by a reset.

The app is intentionally single-workspace. It is designed as a complete
local product demo, not a multi-tenant production deployment.

## Project structure

```text
app/
  page.tsx                 Overview
  login/                   Sign-in page (demo + admin accounts)
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
  prisma.ts                Prisma client singleton (Postgres)
  db.ts                    Serializers, loaders, seed/reset, post writers
  crypto.ts                AES-256-GCM encryption for per-user AI keys
  passwords.ts             scrypt password hashing
  credentials.ts           DB-backed credential verification + demo lookup
  auth.ts                  Session tokens, rate limit, session secret
  publishing.ts            Publishing boundary / mode switch / adapters
  scheduler.ts             Auto-publish loop
  ai.ts                    Prompts, demo fallback, reply suggestions
  ai-providers.ts          Provider registry (Anthropic, OpenAI, Gemini, …)
  ai-settings.ts           Per-user AI settings, encrypted in Postgres
  accounts.ts              Account helpers
  platforms.ts             Platform metadata and limits
  analytics.ts             Analytics aggregation
  overview.ts              Dashboard aggregation
  client.ts                Shared fetch helpers and refresh events
  format.ts                Number/date formatting
  types.ts                 Shared models
prisma/
  schema.prisma            Postgres schema (all entities)
  seed.ts                  Demo user + admin (seed-only env) + workspace
  migrations/              Migration history (applied by `migrate deploy`)
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
| `POST` | `/api/auth/login` | Sign in (sets the session cookie) |
| `POST` | `/api/auth/logout` | Sign out (clears the session cookie) |
| `GET` | `/api/auth/me` | Current signed-in user |
| `POST` | `/api/auth/reset` | Reset the demo workspace (re-seeds on next read) |
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
