import { create } from 'zustand';
import type { CartSummary, CartItem } from '@/types';

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
  itemCount: number;
}

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  isOpen: false,
  appliedCoupon: null,
  appliedObPoints: null,
  setCart: (cart) => set({ cart }),
  setOpen: (open) => set({ isOpen: open }),
  setAppliedCoupon: (coupon) => set({ appliedCoupon: coupon }),
  setAppliedObPoints: (ob) => set({ appliedObPoints: ob }),
  clearCart: () => set({ cart: null, appliedCoupon: null, appliedObPoints: null }),
  get itemCount() {
    return get().cart?.itemCount ?? 0;
  },
}));
