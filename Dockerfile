# Sway — Social Studio, production image for the VPS.
# Multi-stage: install deps -> build Next.js (standalone) -> slim runtime.
# Data lives in /app/data and uploads in /app/public/uploads, both mounted
# as volumes in docker-compose.yml so a rebuild never wipes the workspace.

# syntax=docker/dockerfile:1

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Standalone server output (next.config.ts: output 'standalone').
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Writable at runtime even before any volume is mounted.
RUN mkdir -p /app/data /app/public/uploads

EXPOSE 3000
CMD ["node", "server.js"]
