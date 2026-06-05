'use client';

import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  MagnifyingGlassIcon,
  PaperAirplaneIcon,
  ChatBubbleLeftEllipsisIcon,
  ArrowLeftIcon,
  UserCircleIcon,
  PaperClipIcon,
  XMarkIcon,
  PlayIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import {
  MOCK_THREADS,
  MOCK_MESSAGES,
  type Thread,
  type Message,
  type MessageMedia,
} from '@/app/lib/mock-data';

// ─── Media security constants ─────────────────────────────────────────────────

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;  // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
const MAX_FILES_PER_MESSAGE = 5;

type FileError = { file: string; reason: string };

function validateFiles(files: FileList): { valid: File[]; errors: FileError[] } {
  const valid: File[] = [];
  const errors: FileError[] = [];

  Array.from(files).forEach((f) => {
    const isImage = ALLOWED_IMAGE_TYPES.has(f.type);
    const isVideo = ALLOWED_VIDEO_TYPES.has(f.type);

    if (!isImage && !isVideo) {
      errors.push({ file: f.name, reason: 'Unsupported file type' });
      return;
    }
    const limit = isImage ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (f.size > limit) {
      const mb = Math.round(limit / 1024 / 1024);
      errors.push({ file: f.name, reason: `Exceeds ${mb} MB limit` });
      return;
    }
    valid.push(f);
  });

  return { valid, errors };
}

// ─── Lazy media item (IntersectionObserver for off-screen content) ────────────

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
          <img
            src={item.url}
            alt={item.name}
            loading="lazy"
            decoding="async"
            className="max-w-full max-h-64 object-cover"
          />
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="max-w-full max-h-64 rounded-xl overflow-hidden bg-gray-900">
      {visible ? (
        <video
          src={item.url}
          controls
          preload="none"
          playsInline
          className="max-w-full max-h-64 object-cover"
        >
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

// ─── Thread row ───────────────────────────────────────────────────────────────

function ThreadRow({ thread, active, onClick }: { thread: Thread; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 border-b border-gray-100',
        active && 'bg-violet-50 hover:bg-violet-50'
      )}
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
        <span className="text-xs font-bold text-violet-800">{thread.initials}</span>
      </div>

      {/* Name + preview */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {/* Row 1: name (truncates) + timestamp (always visible) */}
        <div className="flex items-baseline gap-2">
          <span className={cn('text-sm min-w-0 flex-1 truncate leading-snug', active ? 'font-semibold text-violet-900' : 'font-medium text-gray-900')}>
            {thread.name}
          </span>
          <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap leading-snug">{thread.timestamp}</span>
        </div>
        {/* Row 2: preview (truncates) */}
        <p className="text-xs text-gray-500 truncate mt-0.5">{thread.preview}</p>
      </div>

      {/* Unread badge */}
      {thread.unread > 0 && (
        <span className="shrink-0 min-w-4.5 h-4.5 rounded-full bg-violet-700 text-white text-[10px] font-bold flex items-center justify-center px-1">
          {thread.unread}
        </span>
      )}
    </button>
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

// ─── Staged media preview (before sending) ───────────────────────────────────

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

function ConversationPanel({
  thread,
  messages,
  onBack,
  onSend,
}: {
  thread: Thread | null;
  messages: Message[];
  onBack: () => void;
  onSend: (body: string, media: MessageMedia[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const [staged, setStaged] = useState<MessageMedia[]>([]);
  const [fileErrors, setFileErrors] = useState<FileError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);

  // Revoke object URLs when staged items are removed to free memory
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

    const { valid, errors } = validateFiles(files);
    if (errors.length) setFileErrors(errors);

    const capped = valid.slice(0, remaining);
    const newItems: MessageMedia[] = capped.map((f) => ({
      type: f.type.startsWith('video/') ? 'video' : 'image',
      url: URL.createObjectURL(f),
      name: f.name,
    }));
    setStaged((s) => [...s, ...newItems]);
  };

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
        <Button variant="outline" size="sm" className="shrink-0 hidden sm:flex">
          <UserCircleIcon className="size-3.5 mr-1.5" />
          View Profile
        </Button>
      </div>

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
        {/* Validation errors */}
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

          {/* Attachment */}
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MessagesPage() {
  const [threads, setThreads]         = useState<Thread[]>(MOCK_THREADS);
  const [allMessages, setAllMessages] = useState<Message[]>(MOCK_MESSAGES);
  const [activeId, setActiveId]       = useState<string | null>('t1');
  const [search, setSearch]           = useState('');

  const filteredThreads = useMemo(
    () => threads.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [threads, search]
  );

  const activeThread   = threads.find((t) => t.id === activeId) ?? null;
  const activeMessages = useMemo(
    () => allMessages.filter((m) => m.threadId === activeId),
    [allMessages, activeId]
  );

  const selectThread = (id: string) => {
    setActiveId(id);
    setThreads((ts) => ts.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
  };

  const sendMessage = (body: string, media: MessageMedia[]) => {
    if (!activeId) return;
    const msg: Message = {
      id:        `msg-${Date.now()}`,
      threadId:  activeId,
      fromMe:    true,
      body,
      media:     media.length ? media : undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setAllMessages((ms) => [...ms, msg]);
    const preview = body || (media[0]?.type === 'image' ? '📷 Image' : '🎥 Video');
    setThreads((ts) =>
      ts.map((t) => (t.id === activeId ? { ...t, preview, timestamp: 'Just now' } : t))
    );
  };

  const showConvo = !!activeId;

  return (
    <>
        {/* Thread list */}
        <div
          className={cn(
            'flex flex-col bg-white border-r border-gray-200 flex-1 min-w-0 lg:flex-none lg:w-80 overflow-hidden',
            showConvo && 'hidden lg:flex'
          )}
        >
          <div className="px-4 pt-4 pb-3 shrink-0">
            <h1 className="text-xl font-bold text-gray-900 mb-3">Messages</h1>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
              <Input
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-xl bg-gray-50 border-gray-200"
              />
            </div>
          </div>

          <Separator />

          <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-auto">
            {filteredThreads.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No conversations found.</p>
            ) : (
              <div>
                {filteredThreads.map((t) => (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    active={t.id === activeId}
                    onClick={() => selectThread(t.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Conversation */}
        <div className={cn('flex-1 flex min-w-0 min-h-0 overflow-hidden', !showConvo && 'hidden lg:flex')}>
          <ConversationPanel
            thread={activeThread}
            messages={activeMessages}
            onBack={() => setActiveId(null)}
            onSend={sendMessage}
          />
        </div>
    </>
  );
}
