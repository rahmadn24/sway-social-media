import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// Prisma 7 connects through the pg driver adapter (no query-engine binary).
// DATABASE_URL is required: the app has no fallback store anymore.

const globalForPrisma = globalThis as unknown as {
  __swayPrisma?: PrismaClient;
};

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      '[sway] DATABASE_URL is not set. Copy .env.example to .env and set it (see DEPLOY.md).',
    );
  }
  const pool = new Pool({ connectionString, max: 10 });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

export const prisma: PrismaClient =
  globalForPrisma.__swayPrisma ?? createPrismaClient();

// In dev, Next.js hot-reloads modules; reuse the client instead of opening
// a new pool on every reload.
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__swayPrisma = prisma;
}
