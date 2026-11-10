import { Image as ImageIcon, Play } from 'lucide-react';
import type { MediaAsset } from '@/lib/types';

export function MediaThumb({
  media,
  size = 56,
  className = '',
  rounded = 12,
}: {
  media?: MediaAsset;
  size?: number;
  className?: string;
  rounded?: number;
}) {
  if (!media) {
    return (
      <span
        className={`media-thumb media-thumb-empty ${className}`}
        style={{ width: size, height: size, borderRadius: rounded }}
        aria-hidden="true"
      >
        <ImageIcon size={size * 0.28} />
      </span>
    );
  }

  return (
    <span
      className={`media-thumb ${className}`}
      style={{ width: size, height: size, borderRadius: rounded }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={media.url} alt={media.alt ?? ''} loading="lazy" />
      {media.type === 'video' && (
        <span className="media-play">
          <Play size={9} fill="currentColor" />
        </span>
      )}
    </span>
  );
}
