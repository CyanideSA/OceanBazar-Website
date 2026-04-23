import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface MyReview {
  id: string;
  productId: string;
  productTitle: string;
  rating: number;
  body: string;
  createdAt: string;
}

function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `rv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

interface State {
  reviews: MyReview[];
  add: (r: Omit<MyReview, 'id' | 'createdAt'>) => void;
  remove: (id: string) => void;
}

export const useMyReviewsStore = create<State>()(
  persist(
    (set, get) => ({
      reviews: [],
      add: (r) =>
        set({
          reviews: [
            {
              ...r,
              id: genId(),
              createdAt: new Date().toISOString(),
            },
            ...get().reviews,
          ],
        }),
      remove: (id) => set({ reviews: get().reviews.filter((x) => x.id !== id) }),
    }),
    { name: 'ob_my_reviews_v1' }
  )
);
