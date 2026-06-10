// Server component — no 'use client'.
// Reads initial thread + message data and passes it to the client orchestrator.
import { MOCK_THREADS, MOCK_MESSAGES } from '@/app/lib/mock-data';
import MessagesClient from '@/app/components/messages/messages-client';

export default function MessagesPage() {
  return <MessagesClient initialThreads={MOCK_THREADS} initialMessages={MOCK_MESSAGES} />;
}
