import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX = 4;

interface State {
  ids: string[];
  add: (id: string) => boolean;
  remove: (id: string) => void;
  has: (id: string) => boolean;
  clear: () => void;
}

export const useCompareStore = create<State>()(
  persist(
    (set, get) => ({
      ids: [],
      add: (id) => {
        const cur = get().ids;
        if (cur.includes(id)) return true;
        if (cur.length >= MAX) return false;
        set({ ids: [...cur, id] });
        return true;
      },
      remove: (id) => set({ ids: get().ids.filter((x) => x !== id) }),
      has: (id) => get().ids.includes(id),
      clear: () => set({ ids: [] }),
    }),
    { name: 'ob_compare_v1' }
  )
);
