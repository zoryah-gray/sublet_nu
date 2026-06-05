'use client';

import { createContext, useContext, useState, useMemo } from 'react';
import { MOCK_NOTIFICATIONS, type Notification } from '@/app/lib/mock-data';

type NotificationsContextValue = {
  notifications: Notification[];
  hasUnread: boolean;
  hasSeen: boolean;
  onBellOpen: () => void;
  onBellClose: () => void;
  dismissOne: (id: string) => void;
  clearAll: () => void;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const [hasSeen, setHasSeen] = useState(false);

  const hasUnread = useMemo(() => notifications.some((n) => !n.read), [notifications]);

  const onBellOpen = () => {
    if (hasUnread) {
      setNotifications((ns) => ns.map((n) => ({ ...n, read: true })));
      setHasSeen(true);
    }
  };

  const onBellClose = () => {
    if (notifications.length === 0) setHasSeen(false);
  };

  const dismissOne = (id: string) => {
    setNotifications((ns) => {
      const next = ns.filter((n) => n.id !== id);
      if (next.length === 0) setHasSeen(false);
      return next;
    });
  };

  const clearAll = () => {
    setNotifications([]);
    setHasSeen(false);
  };

  return (
    <NotificationsContext.Provider
      value={{ notifications, hasUnread, hasSeen, onBellOpen, onBellClose, dismissOne, clearAll }}
    >
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
