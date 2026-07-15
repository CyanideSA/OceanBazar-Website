import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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
      setCart: (cart) => set({ cart }),
      setOpen: (open) => set({ isOpen: open }),
      setAppliedCoupon: (coupon) => set({ appliedCoupon: coupon }),
      setAppliedObPoints: (ob) => set({ appliedObPoints: ob }),
      clearCart: () => set({ cart: null, appliedCoupon: null, appliedObPoints: null }),
    }),
    {
      name: 'ob-cart-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        cart: s.cart,
        appliedCoupon: s.appliedCoupon,
        appliedObPoints: s.appliedObPoints,
      }),
    }
  )
);
