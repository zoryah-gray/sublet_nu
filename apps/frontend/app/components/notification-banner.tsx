'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';

export type BannerType = 'success' | 'error' | 'warning' | 'info';

interface NotificationBannerProps {
  type: BannerType;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

const STYLES: Record<BannerType, string> = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error:   'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info:    'bg-violet-50 border-violet-200 text-violet-800',
};

export default function NotificationBanner({
  type,
  message,
  onDismiss,
  className,
}: NotificationBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        'absolute top-[60px] left-0 w-full flex items-start justify-between gap-3 border px-4 py-3 text-sm font-medium',
        STYLES[type],
        className,
      )}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
        >
          <XMarkIcon className="size-4" />
        </button>
      )}
    </div>
  );
}
