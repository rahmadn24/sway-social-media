import { LoginForm } from './LoginForm';

export const metadata = {
  title: 'Sign in — Sway',
  description: 'Sign in to your Sway workspace.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next =
    typeof params.next === 'string' && params.next.startsWith('/') ? params.next : '/';
  return <LoginForm next={next} />;
}
