import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface State {
  ids: string[];
  toggle: (id: string) => void;
  has: (id: string) => boolean;
  setIds: (ids: string[]) => void;
  mergeIds: (serverIds: string[]) => void;
}

export const useWishlistStore = create<State>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set({
          ids: get().ids.includes(id) ? get().ids.filter((x) => x !== id) : [...get().ids, id],
        }),
      has: (id) => get().ids.includes(id),
      setIds: (ids) => set({ ids }),
      mergeIds: (serverIds) => {
        const merged = [...new Set([...get().ids, ...serverIds])];
        set({ ids: merged });
      },
    }),
    { name: 'ob_wishlist_v1' }
  )
);
