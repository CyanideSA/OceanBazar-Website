import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  guestAddToCart,
  guestRemoveFromCart,
  guestUpdateCartQty,
  normalizeCartSummary,
  type GuestCartAddInput,
} from '@/lib/cart';
import type { CartSummary } from '@/types';

/** localStorage can throw in private mode / full quota on older iOS — never crash the store. */
function safeLocalStorage(): Storage {
  if (typeof window === 'undefined') {
    const mem = new Map<string, string>();
    return {
      get length() { return mem.size; },
      clear: () => mem.clear(),
      getItem: (k) => mem.get(k) ?? null,
      key: (i) => Array.from(mem.keys())[i] ?? null,
      removeItem: (k) => { mem.delete(k); },
      setItem: (k, v) => { mem.set(k, v); },
    };
  }
  try {
    const probe = '__ob_ls_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      get length() { return mem.size; },
      clear: () => mem.clear(),
      getItem: (k) => mem.get(k) ?? null,
      key: (i) => Array.from(mem.keys())[i] ?? null,
      removeItem: (k) => { mem.delete(k); },
      setItem: (k, v) => { mem.set(k, v); },
    };
  }
}

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
  /** Guest-only local cart mutations (no API). */
  addLocalItem: (input: GuestCartAddInput) => CartSummary;
  updateLocalQty: (productId: string, quantity: number, variantId?: string | null) => CartSummary;
  removeLocalItem: (productId: string, variantId?: string | null) => CartSummary;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cart: null,
      isOpen: false,
      appliedCoupon: null,
      appliedObPoints: null,
      setCart: (cart) => set({ cart: cart ? normalizeCartSummary(cart) : cart }),
      setOpen: (open) => set({ isOpen: open }),
      setAppliedCoupon: (coupon) => set({ appliedCoupon: coupon }),
      setAppliedObPoints: (ob) => set({ appliedObPoints: ob }),
      clearCart: () => set({ cart: null, appliedCoupon: null, appliedObPoints: null }),
      addLocalItem: (input) => {
        const next = guestAddToCart(get().cart, input);
        set({ cart: next });
        return next;
      },
      updateLocalQty: (productId, quantity, variantId) => {
        const next = guestUpdateCartQty(get().cart, productId, quantity, variantId);
        set({ cart: next });
        return next;
      },
      removeLocalItem: (productId, variantId) => {
        const next = guestRemoveFromCart(get().cart, productId, variantId);
        set({ cart: next });
        return next;
      },
    }),
    {
      name: 'ob-cart-v2',
      storage: createJSONStorage(() => safeLocalStorage()),
      partialize: (s) => ({
        cart: s.cart,
        appliedCoupon: s.appliedCoupon,
        appliedObPoints: s.appliedObPoints,
      }),
      merge: (persisted, current) => {
        try {
          const root = persisted as { state?: Partial<CartState> } & Partial<CartState>;
          const saved = root.state ?? root;
          return {
            ...current,
            appliedCoupon: saved.appliedCoupon ?? current.appliedCoupon,
            appliedObPoints: saved.appliedObPoints ?? current.appliedObPoints,
            cart: saved.cart ? normalizeCartSummary(saved.cart) : null,
            isOpen: false,
          };
        } catch {
          return { ...current, isOpen: false };
        }
      },
    }
  )
);
