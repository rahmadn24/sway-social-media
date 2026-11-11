'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Brand, Spinner } from '@/components/ui';

// No credentials are shown on this page. The demo account is entered
// through POST /api/auth/demo (no password involved); the admin account
// signs in with the email/password created at seed time.
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  // Already signed in? Skip the form and go straight to the workspace.
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then((response) => {
        if (!cancelled && response.ok) router.replace(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [next, router]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || 'Invalid email or password.');
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function enterDemo() {
    setError('');
    setDemoLoading(true);
    try {
      const response = await fetch('/api/auth/demo', { method: 'POST' });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(data.error || 'Demo is not available right now.');
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="auth-brand">
          <Brand href="/login" />
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Sign in to your Sway workspace.</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label className="label" htmlFor="auth-email">
              Email
            </label>
            <input
              id="auth-email"
              className="input"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="auth-password">
              Password
            </label>
            <input
              id="auth-password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              required
            />
          </div>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary btn-lg btn-block auth-submit" type="submit" disabled={loading}>
            {loading ? (
              <>
                <Spinner size={16} /> Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <div className="auth-demo">
          <p className="auth-demo-title">Just looking around?</p>
          <p>
            Explore the full workspace with the demo account. The workspace can be
            reset to fresh demo data whenever needed.
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={enterDemo}
            disabled={demoLoading}
          >
            {demoLoading ? (
              <>
                <Spinner size={16} /> Entering demo…
              </>
            ) : (
              'Try the demo'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
