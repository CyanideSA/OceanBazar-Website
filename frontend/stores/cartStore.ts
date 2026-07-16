import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { normalizeCartSummary } from '@/lib/cart';
import type { CartSummary } from '@/types';

interface CartState {
  cart: CartSummary | null;
  isOpen: boolean;
  appliedCoupon: { id: number; code: string; type: string; value: number } | null;
  appliedObPoints: { points: number; bdtDiscount: number } | null;
  setCart: (cart: CartSummary) => void;
  setOpen: (open: boolean) => void;
  setAppliedCoupon: (coupon: CartState['appliedCoupon']) => void;
  setAppliedObPoints: (ob: CartState['appliedObPoints']) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      cart: null,
      isOpen: false,
      appliedCoupon: null,
      appliedObPoints: null,
      setCart: (cart) => set({ cart: cart ? normalizeCartSummary(cart) : cart }),
      setOpen: (open) => set({ isOpen: open }),
      setAppliedCoupon: (coupon) => set({ appliedCoupon: coupon }),
      setAppliedObPoints: (ob) => set({ appliedObPoints: ob }),
      clearCart: () => set({ cart: null, appliedCoupon: null, appliedObPoints: null }),
    }),
    {
      name: 'ob-cart-v2',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        cart: s.cart,
        appliedCoupon: s.appliedCoupon,
        appliedObPoints: s.appliedObPoints,
      }),
      merge: (persisted, current) => {
        const root = persisted as { state?: Partial<CartState> } & Partial<CartState>;
        const saved = root.state ?? root;
        return {
          ...current,
          appliedCoupon: saved.appliedCoupon ?? current.appliedCoupon,
          appliedObPoints: saved.appliedObPoints ?? current.appliedObPoints,
          cart: saved.cart ? normalizeCartSummary(saved.cart) : null,
          isOpen: false,
        };
      },
    }
  )
);
