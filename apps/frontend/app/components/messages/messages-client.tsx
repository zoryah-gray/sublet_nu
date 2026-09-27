'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { Thread, Message, MessageMedia, MatchRequest, Sublet } from '@/app/lib/definitions';
import { MOCK_MATCH_REQUESTS, MOCK_SUBLETS } from '@/app/lib/mock-data';
import ThreadRow from './thread-row';
import ConversationPanel from './conversation-panel';

interface MessagesClientProps {
  initialThreads: Thread[];
  initialMessages: Message[];
}

/** Client orchestrator for the messages page — owns all real-time state. */
export default function MessagesClient({ initialThreads, initialMessages }: MessagesClientProps) {
  const [threads, setThreads]         = useState<Thread[]>(initialThreads);
  const [allMessages, setAllMessages] = useState<Message[]>(initialMessages);
  const [activeId, setActiveId]       = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [localConfirmedIds, setLocalConfirmedIds] = useState<Set<string>>(new Set());

  // threadId → MatchRequest
  const threadMatchMap = useMemo(() => {
    const map: Record<string, MatchRequest> = {};
    MOCK_MATCH_REQUESTS.forEach((r) => { if (r.threadId) map[r.threadId] = r; });
    return map;
  }, []);

  // subletId → Sublet
  const subletMap = useMemo(() => {
    const map: Record<string, Sublet> = {};
    MOCK_SUBLETS.forEach((s) => { map[s.id] = s; });
    return map;
  }, []);

  const filteredThreads = useMemo(
    () => threads.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [threads, search]
  );

  const activeThread   = threads.find((t) => t.id === activeId) ?? null;
  const activeMessages = useMemo(
    () => allMessages.filter((m) => m.threadId === activeId),
    [allMessages, activeId]
  );

  // Override status to 'confirmed' for locally confirmed matches
  const activeMatchRaw = activeId ? threadMatchMap[activeId] : undefined;
  const activeMatch    = activeMatchRaw && localConfirmedIds.has(activeMatchRaw.id)
    ? { ...activeMatchRaw, status: 'confirmed' as const }
    : activeMatchRaw;
  const activeSublet   = activeMatch ? subletMap[activeMatch.subletId] : undefined;

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
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Messages</h1>
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
              {filteredThreads.map((t) => {
                const mr = threadMatchMap[t.id];
                const effectiveMr = mr && localConfirmedIds.has(mr.id)
                  ? { ...mr, status: 'confirmed' as const }
                  : mr;
                return (
                  <ThreadRow
                    key={t.id}
                    thread={t}
                    active={t.id === activeId}
                    onClick={() => selectThread(t.id)}
                    matchRequest={effectiveMr}
                  />
                );
              })}
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
          matchRequest={activeMatch}
          linkedSublet={activeSublet}
          onConfirmSublet={
            activeMatch
              ? () => setLocalConfirmedIds((ids) => new Set([...ids, activeMatch.id]))
              : undefined
          }
        />
      </div>
    </>
  );
}
