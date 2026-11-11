import { defineConfig } from 'prisma/config';

// Load .env so `prisma migrate` / `prisma db seed` pick up DATABASE_URL
// without exporting it first. (The Next.js server loads .env itself.)
// Missing .env is fine — commands that need a database fail loudly then.
try {
  process.loadEnvFile();
} catch {
  // No .env file; rely on the ambient environment.
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Read directly (not env()) so commands that do not need a database
    // (e.g. `prisma generate`, `prisma validate`) still work without
    // DATABASE_URL set. Migrate commands fail loudly when it is missing.
    url: process.env.DATABASE_URL,
  },
});
