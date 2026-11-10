export function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return '0';
  if (Math.abs(value) >= 1_000_000) {
    const formatted = value / 1_000_000;
    return `${formatted >= 10 ? formatted.toFixed(1).replace(/\.0$/, '') : formatted.toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    const formatted = value / 1_000;
    return `${formatted >= 100 ? Math.round(formatted) : formatted.toFixed(1).replace(/\.0$/, '')}K`;
  }
  return Math.round(value).toLocaleString('en-US');
}

export function formatPercent(value: number, withSign = false): string {
  const prefix = withSign && value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(1).replace(/\.0$/, '')}%`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

export function formatRelative(value: string | Date, now = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 3_600_000;
  const day = 86_400_000;

  if (abs < minute) return diff <= 0 ? 'Just now' : 'In a moment';
  if (abs < hour) {
    const amount = Math.round(abs / minute);
    return diff < 0 ? `${amount}m ago` : `in ${amount}m`;
  }
  if (abs < day) {
    const amount = Math.round(abs / hour);
    return diff < 0 ? `${amount}h ago` : `in ${amount}h`;
  }
  if (abs < day * 7) {
    const amount = Math.round(abs / day);
    return diff < 0 ? `${amount}d ago` : `in ${amount}d`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatScheduled(value?: string): string {
  if (!value) return 'Not scheduled';
  const date = new Date(value);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isSameDay(date, now)) return `Today · ${time}`;
  if (isSameDay(date, tomorrow)) return `Tomorrow · ${time}`;
  return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${time}`;
}

export function formatShortDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatLongDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatMessageTime(value: string): string {
  const date = new Date(value);
  const now = new Date();
  if (isSameDay(date, now)) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function localDateTimeInput(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function toIsoFromLocal(value: string): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

export function addMonths(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);
}

export function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function platformSummary(platforms: string[]): string {
  if (platforms.length === 0) return 'No channels';
  if (platforms.length === 1) return platforms[0][0].toUpperCase() + platforms[0].slice(1);
  return `${platforms[0][0].toUpperCase() + platforms[0].slice(1)} +${platforms.length - 1}`;
}

export function avatarGradient(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  const palettes = [
    'linear-gradient(135deg, #EBD9C2, #D5B894)',
    'linear-gradient(135deg, #D9E4CE, #B8CCAE)',
    'linear-gradient(135deg, #E6D8EA, #CBB5D5)',
    'linear-gradient(135deg, #F2D7CA, #DDB09C)',
    'linear-gradient(135deg, #D5E2E8, #AEC8D4)',
    'linear-gradient(135deg, #E9E0C7, #D1C39D)',
  ];
  return palettes[Math.abs(hash) % palettes.length];
}
