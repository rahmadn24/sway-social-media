import { prisma } from '../lib/prisma';
import { hashPassword, randomPassword } from '../lib/passwords';
import { seedWorkspaceContent } from '../lib/db';

// Idempotent seed. Safe to run on every deploy:
// - demo user is upserted by email (its password is a random hash nobody
//   knows; the only way in as demo is POST /api/auth/demo, which looks the
//   user up by role='demo').
// - admin user is created/updated ONLY when SWAY_ADMIN_EMAIL and
//   SWAY_ADMIN_PASSWORD are set in the environment.
// - demo workspace content is inserted ONLY on a fresh database (no
//   accounts yet). Existing content is never overwritten.

const DEMO_EMAIL = 'demo@sway.local';

async function main(): Promise<void> {
  const demo = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { role: 'demo' },
    create: {
      email: DEMO_EMAIL,
      passwordHash: await hashPassword(randomPassword()),
      role: 'demo',
      name: 'Demo',
    },
  });
  console.log(`[sway seed] demo user ready (role=demo, id=${demo.id})`);

  const adminEmail = process.env.SWAY_ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SWAY_ADMIN_PASSWORD;
  if (adminEmail && adminPassword) {
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        role: 'admin',
        passwordHash: await hashPassword(adminPassword),
      },
      create: {
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        role: 'admin',
        name: 'Admin',
      },
    });
    console.log(`[sway seed] admin user ready (${admin.email})`);
  } else {
    console.log(
      '[sway seed] admin user skipped: set SWAY_ADMIN_EMAIL and SWAY_ADMIN_PASSWORD to create one.',
    );
  }

  const accountCount = await prisma.account.count();
  if (accountCount === 0) {
    await seedWorkspaceContent();
    console.log('[sway seed] demo workspace content seeded (accounts, posts, inbox, analytics).');
  } else {
    console.log('[sway seed] workspace content already present, skipped.');
  }
}

main()
  .catch((error) => {
    console.error('[sway seed] failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
