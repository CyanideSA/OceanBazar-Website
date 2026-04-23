import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface StoredNotification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `nt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface State {
  items: StoredNotification[];
  add: (n: Omit<StoredNotification, 'id' | 'read' | 'createdAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useNotificationsStore = create<State>()(
  persist(
    (set, get) => ({
      items: [],
      add: (n) =>
        set({
          items: [
            {
              ...n,
              id: genId(),
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...get().items,
          ],
        }),
      markRead: (id) =>
        set({
          items: get().items.map((x) => (x.id === id ? { ...x, read: true } : x)),
        }),
      markAllRead: () => set({ items: get().items.map((x) => ({ ...x, read: true })) }),
      remove: (id) => set({ items: get().items.filter((x) => x.id !== id) }),
      clear: () => set({ items: [] }),
    }),
    { name: 'ob_notifications_v1' }
  )
);
