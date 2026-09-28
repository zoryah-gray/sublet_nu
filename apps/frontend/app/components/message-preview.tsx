'use client';

import { useState, useRef, useLayoutEffect } from 'react';
import { cn } from '@/lib/utils';

interface MessagePreviewProps {
  message: string;
  emptyLabel?: string;
  className?: string;
}

/**
 * Renders a line-clamped message with a "Read more / Show less" toggle.
 * The button is only shown when the text is actually overflowing at the
 * current viewport width — detected via scrollHeight vs clientHeight so
 * it works correctly across all screen sizes.
 */
export default function MessagePreview({
  message,
  emptyLabel = 'No message attached',
  className,
}: MessagePreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const check = () => setIsClamped(el.scrollHeight > el.clientHeight);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded, message]);

  if (!message) {
    return <p className={cn('text-xs text-gray-400 italic mt-0.5', className)}>{emptyLabel}</p>;
  }

  return (
    <div className={cn('mt-0.5', className)}>
      <p ref={ref} className={cn('text-xs text-gray-500', !expanded && 'line-clamp-2')}>
        {message}
      </p>
      {isClamped && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-violet-600 hover:text-violet-800 transition-colors mt-0.5"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}
