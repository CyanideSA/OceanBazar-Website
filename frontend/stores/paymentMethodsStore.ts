import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MobileProvider = 'bkash' | 'nagad' | 'rocket' | 'upay' | 'other';

export type SavedMobile = {
  id: string;
  kind: 'mobile';
  provider: MobileProvider;
  number: string;
  label?: string;
};

export type SavedCard = {
  id: string;
  kind: 'card';
  brand: string;
  last4: string;
  label?: string;
};

export type SavedBank = {
  id: string;
  kind: 'bank';
  bankName: string;
  accountName: string;
  accountNumber: string;
  branch?: string;
  label?: string;
};

export type SavedPaymentMethod = SavedMobile | SavedCard | SavedBank;

function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `pm-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type NewMethod = Omit<SavedMobile, 'id'> | Omit<SavedCard, 'id'> | Omit<SavedBank, 'id'>;

interface State {
  methods: SavedPaymentMethod[];
  add: (m: NewMethod) => void;
  update: (id: string, m: NewMethod) => void;
  remove: (id: string) => void;
}

export const usePaymentMethodsStore = create<State>()(
  persist(
    (set, get) => ({
      methods: [],
      add: (m) =>
        set({
          methods: [...get().methods, { ...m, id: genId() } as SavedPaymentMethod],
        }),
      update: (id, m) =>
        set({
          methods: get().methods.map((x) => (x.id === id ? ({ ...(m as object), id } as SavedPaymentMethod) : x)),
        }),
      remove: (id) => set({ methods: get().methods.filter((x) => x.id !== id) }),
    }),
    { name: 'ob_payment_methods_v1' }
  )
);
