export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Fail hard at startup (production) when the secrets Sway needs are
    // missing — a server without a session secret or an encryption key
    // must never silently run with weak defaults. Exit non-zero so the
    // container runtime restarts (and surfaces) the failure instead of
    // hanging in a half-started state.
    try {
      const { getSessionSecret } = await import('./lib/auth');
      const { getEncryptionKey } = await import('./lib/crypto');
      await getSessionSecret();
      getEncryptionKey();
    } catch (error) {
      console.error(
        '[sway] startup secret check failed:',
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }

    const { startScheduler } = await import('./lib/scheduler');
    startScheduler();
  }
}
