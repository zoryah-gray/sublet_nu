'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  PaperAirplaneIcon,
  ChatBubbleLeftEllipsisIcon,
  ArrowLeftIcon,
  UserCircleIcon,
  PaperClipIcon,
  XMarkIcon,
  PlayIcon,
  ExclamationTriangleIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';
import type { Thread, Message, MessageMedia, MatchRequest, Sublet } from '@/app/lib/definitions';
import { MATCH_STATUS_STYLES, MATCH_STATUS_LABELS } from '@/app/lib/definitions';
import { CURRENT_USER_ID } from '@/app/lib/mock-data';
import {
  validateMediaFiles,
  type FileValidationError,
} from '@/app/lib/utils';
import ConfirmSubletButton from '@/app/components/match/confirm-sublet-button';


const MAX_FILES_PER_MESSAGE = 5;

// ─── Lazy media item ──────────────────────────────────────────────────────────

function LazyMediaItem({ item }: { item: MessageMedia }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (item.type === 'image') {
    return (
      <div ref={ref} className="max-w-full max-h-64 rounded-xl overflow-hidden bg-gray-100">
        {visible && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.url} alt={item.name} loading="lazy" decoding="async" className="max-w-full max-h-64 object-cover" />
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="max-w-full max-h-64 rounded-xl overflow-hidden bg-gray-900">
      {visible ? (
        <video src={item.url} controls preload="none" playsInline className="max-w-full max-h-64 object-cover">
          <track kind="captions" />
        </video>
      ) : (
        <div className="flex items-center justify-center h-32 w-48">
          <PlayIcon className="size-8 text-white/60" />
        </div>
      )}
    </div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const hasMedia = !!msg.media?.length;
  const hasText  = msg.body.trim().length > 0;

  return (
    <div className={cn('flex', msg.fromMe ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[70%] flex flex-col gap-1.5', msg.fromMe ? 'items-end' : 'items-start')}>
        {hasMedia && (
          <div className="flex flex-col gap-1.5">
            {msg.media!.map((m, i) => <LazyMediaItem key={i} item={m} />)}
          </div>
        )}
        {hasText && (
          <div className={cn(
            'px-3.5 py-2.5 text-sm leading-relaxed',
            msg.fromMe
              ? 'bg-violet-700 text-white rounded-2xl rounded-br-sm'
              : 'bg-gray-100 text-gray-900 rounded-2xl rounded-bl-sm'
          )}>
            {msg.body}
          </div>
        )}
        <p className={cn('text-[11px] text-gray-400', msg.fromMe ? 'text-right' : 'text-left')}>
          {msg.timestamp}
        </p>
      </div>
    </div>
  );
}

// ─── Staged media preview ─────────────────────────────────────────────────────

function StagedPreview({ items, onRemove }: { items: MessageMedia[]; onRemove: (i: number) => void }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-wrap gap-2 px-4 pt-3 pb-1">
      {items.map((item, i) => (
        <div key={i} className="relative group">
          {item.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt={item.name} loading="lazy" className="h-16 w-16 rounded-xl object-cover border border-gray-200" />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-gray-900 flex items-center justify-center border border-gray-700">
              <PlayIcon className="size-6 text-white/70" />
            </div>
          )}
          <button
            onClick={() => onRemove(i)}
            aria-label={`Remove ${item.name}`}
            className="absolute -top-1.5 -right-1.5 size-4.5 rounded-full bg-gray-800 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <XMarkIcon className="size-2.5" />
          </button>
          <p className="text-[10px] text-gray-400 truncate max-w-16 mt-0.5 text-center">{item.name}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Conversation panel ───────────────────────────────────────────────────────

export interface ConversationPanelProps {
  thread: Thread | null;
  messages: Message[];
  onBack: () => void;
  onSend: (body: string, media: MessageMedia[]) => void;
  matchRequest?: MatchRequest;
  linkedSublet?: Sublet;
  onConfirmSublet?: () => void;
}

/** Full conversation view: header, match context banner, message list, and input area. */
export default function ConversationPanel({
  thread,
  messages,
  onBack,
  onSend,
  matchRequest,
  linkedSublet,
  onConfirmSublet,
}: ConversationPanelProps) {
  const [draft, setDraft]           = useState('');
  const [staged, setStaged]         = useState<MessageMedia[]>([]);
  const [fileErrors, setFileErrors] = useState<FileValidationError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef    = useRef<HTMLDivElement>(null);

  const removeStaged = useCallback((i: number) => {
    setStaged((s) => {
      URL.revokeObjectURL(s[i].url);
      return s.filter((_, idx) => idx !== i);
    });
  }, []);

  // Revoke all staged URLs on unmount
  useEffect(() => {
    return () => { staged.forEach((m) => URL.revokeObjectURL(m.url)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!thread) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-gray-400 bg-gray-50">
        <ChatBubbleLeftEllipsisIcon className="size-10" />
        <p className="text-sm">Select a conversation</p>
      </div>
    );
  }

  const canSend = draft.trim().length > 0 || staged.length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(draft.trim(), staged);
    setDraft('');
    setStaged([]);
    setFileErrors([]);
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    setFileErrors([]);

    const remaining = MAX_FILES_PER_MESSAGE - staged.length;
    if (remaining <= 0) {
      setFileErrors([{ file: '', reason: `Max ${MAX_FILES_PER_MESSAGE} files per message` }]);
      return;
    }

    const { valid, errors } = validateMediaFiles(files);
    if (errors.length) setFileErrors(errors);

    const newItems: MessageMedia[] = valid.slice(0, remaining).map((f) => ({
      type: f.type.startsWith('video/') ? 'video' : 'image',
      url:  URL.createObjectURL(f),
      name: f.name,
    }));
    setStaged((s) => [...s, ...newItems]);
  };

  const isOwnerOfMatch = matchRequest?.ownerId === CURRENT_USER_ID;

  return (
    <div className="flex-1 flex flex-col bg-white min-w-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3 shrink-0">
        <button
          onClick={onBack}
          className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Back to conversations"
        >
          <ArrowLeftIcon className="size-4" />
        </button>
        <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-violet-800">{thread.initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{thread.name}</p>
          <p className="text-xs text-gray-400 truncate">{thread.email}</p>
        </div>
        {thread.userId && (
          <Link
            href={`/profile/${thread.userId}`}
            className="shrink-0 hidden sm:flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <UserCircleIcon className="size-3.5" />
            View Profile
          </Link>
        )}
      </div>

      {/* Match context banner */}
      {matchRequest && linkedSublet && (
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 shrink-0">
          <HomeIcon className="size-3.5 text-gray-400 shrink-0" />
          <Link
            href={`/sublet/${linkedSublet.id}`}
            className="text-xs text-violet-700 hover:underline font-medium truncate flex-1"
          >
            {linkedSublet.title}
          </Link>
          <span className="text-xs text-gray-400 shrink-0">
            ${linkedSublet.price.toLocaleString()}/mo
          </span>
          {isOwnerOfMatch && matchRequest.status === 'accepted' && onConfirmSublet && (
            <ConfirmSubletButton
              requesterName={matchRequest.requesterName}
              onConfirm={onConfirmSublet}
            />
          )}
          {matchRequest.status === 'confirmed' && (
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0', MATCH_STATUS_STYLES.confirmed)}>
              {MATCH_STATUS_LABELS.confirmed} ✓
            </span>
          )}
        </div>
      )}

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-5 py-4 space-y-4">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">No messages yet. Say hi!</p>
          ) : (
            messages.map((m) => <Bubble key={m.id} msg={m} />)
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t border-gray-200 shrink-0">
        {fileErrors.length > 0 && (
          <div className="px-4 pt-2 flex flex-col gap-1">
            {fileErrors.map((e, i) => (
              <p key={i} className="text-xs text-red-500 flex items-center gap-1">
                <ExclamationTriangleIcon className="size-3 shrink-0" />
                {e.file ? <><span className="font-medium">{e.file}</span>: {e.reason}</> : e.reason}
              </p>
            ))}
          </div>
        )}

        <StagedPreview items={staged} onRemove={removeStaged} />

        <div className="px-4 py-3 flex gap-2 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/avif,video/mp4,video/webm,video/ogg,video/quicktime"
            multiple
            className="hidden"
            onChange={(e) => { handleFiles(e.target.files); (e.target as HTMLInputElement).value = ''; }}
          />
          <Input
            placeholder={`Message ${thread.name}…`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit()}
            className="flex-1 rounded-xl bg-gray-50 border-gray-200 focus-visible:bg-white"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach image or video"
            title={`Images up to 10 MB · Videos up to 100 MB · Max ${MAX_FILES_PER_MESSAGE} files`}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors shrink-0"
          >
            <PaperClipIcon className="size-4.5" />
          </button>
          <Button
            size="icon"
            onClick={submit}
            disabled={!canSend}
            aria-label="Send message"
            className="shrink-0"
          >
            <PaperAirplaneIcon className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
