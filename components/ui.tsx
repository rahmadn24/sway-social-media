'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  AtSign,
  Check,
  Facebook,
  Instagram,
  LoaderCircle,
  Music2,
  X,
  Youtube,
} from 'lucide-react';
import type { Platform, PostStatus } from '@/lib/types';
import { avatarGradient, initials } from '@/lib/format';

const PLATFORM_ICONS = {
  instagram: Instagram,
  youtube: Youtube,
  tiktok: Music2,
  threads: AtSign,
  facebook: Facebook,
};

export function Brand({
  compact = false,
  href = '/',
}: {
  compact?: boolean;
  href?: string;
}) {
  return (
    <Link href={href} className="brand" aria-label="Sway home">
      <span className="brand-mark">
        <svg viewBox="0 0 28 28" aria-hidden="true">
          <path
            d="M7 17.7c1.9 2.1 4.3 3.2 7 3.2 3.9 0 6.4-1.8 6.4-4.4 0-2.6-2.1-3.7-5.8-4.4-3-.6-4.2-1.2-4.2-2.6 0-1.4 1.4-2.4 3.4-2.4 2.1 0 3.9.8 5.3 2.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <circle cx="20.9" cy="7.3" r="2.1" fill="currentColor" />
        </svg>
      </span>
      {!compact && (
        <span className="brand-word">
          sway<span className="brand-dot">.</span>
        </span>
      )}
    </Link>
  );
}

export function PlatformIcon({
  platform,
  size = 18,
  badge = false,
  className = '',
}: {
  platform: Platform;
  size?: number;
  badge?: boolean;
  className?: string;
}) {
  const Icon = PLATFORM_ICONS[platform];
  if (!badge) {
    return <Icon size={size} className={`platform-glyph platform-glyph-${platform} ${className}`} />;
  }

  return (
    <span
      className={`platform-badge platform-badge-${platform} ${className}`}
      style={{ width: size + 12, height: size + 12 }}
      title={platform[0].toUpperCase() + platform.slice(1)}
    >
      <Icon size={size} strokeWidth={1.9} />
    </span>
  );
}

export function PlatformStack({
  platforms,
  size = 14,
  limit = 5,
}: {
  platforms: Platform[];
  size?: number;
  limit?: number;
}) {
  return (
    <span className="platform-stack">
      {platforms.slice(0, limit).map((platform) => (
        <PlatformIcon key={platform} platform={platform} size={size} badge />
      ))}
    </span>
  );
}

export function Avatar({
  name,
  src,
  size = 40,
  className = '',
}: {
  name: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <span
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        background: avatarGradient(name),
        fontSize: Math.max(10, size * 0.32),
      }}
      aria-label={name}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} />
      ) : (
        <span>{initials(name)}</span>
      )}
    </span>
  );
}

export function StatusBadge({ status, short = false }: { status: PostStatus; short?: boolean }) {
  const labels: Record<PostStatus, string> = {
    draft: 'Draft',
    scheduled: short ? 'Queued' : 'Scheduled',
    published: 'Published',
    failed: 'Needs attention',
  };
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" />
      {labels[status]}
    </span>
  );
}

export function LiveDot({ tone = 'live' }: { tone?: 'live' | 'warn' | 'quiet' }) {
  return <span className={`live-dot live-dot-${tone}`} />;
}

export function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={`toggle ${checked ? 'toggle-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-thumb">{checked && <Check size={10} strokeWidth={3} />}</span>
    </button>
  );
}

export function Spinner({ size = 18 }: { size?: number }) {
  return <LoaderCircle className="spinner" size={size} aria-label="Loading" />;
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className = '',
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <header className={`page-header ${className}`}>
      <div className="page-title-group">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="modal-layer" role="presentation">
      <button className="modal-backdrop" aria-label="Close dialog" onClick={onClose} />
      <div
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <header className="modal-head">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <span className={`skeleton ${className}`} style={style} aria-hidden="true" />;
}

export function Divider() {
  return <div className="soft-divider" />;
}
