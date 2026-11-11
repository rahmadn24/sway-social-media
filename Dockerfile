# Sway — Social Studio, production image for the VPS.
# Multi-stage: install deps -> build Next.js (standalone) -> slim runtime.
# All structured data lives in Postgres (prisma/schema.prisma); only
# uploads stay on disk in /app/public/uploads (volume in docker-compose.yml).
# The entrypoint applies Prisma migrations and seeds before starting the
# server, so a rebuild never wipes the workspace and auto-deploy can ship
# schema changes.

# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate the Prisma client before the Next.js build bundles it.
# (No DATABASE_URL is needed for generate.)
RUN npx prisma generate
# Next.js imports every route module at build time to collect page data,
# and lib/prisma.ts throws when DATABASE_URL is unset — while .dockerignore
# keeps the real .env out of the build. Give the builder a dummy value:
# page-data collection only imports modules, it never connects, and the
# runner stage gets the real URL from the VPS .env at runtime.
ARG DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV DATABASE_URL=$DATABASE_URL
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Standalone server output (next.config.ts: output 'standalone').
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# The entrypoint runs `prisma migrate deploy` + `prisma db seed` before
# starting the server, so it needs the Prisma CLI, tsx, the generated
# client, the schema/migrations, the seed's lib/ imports and the config —
# i.e. the full node_modules plus prisma/, lib/ and prisma.config.ts.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Uploads stay on disk; writable at runtime even before any volume mounts.
RUN mkdir -p /app/public/uploads

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
