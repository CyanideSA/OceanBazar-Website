import { create } from 'zustand';
import type { OBPointsInfo } from '@/types';

interface OBPointsState {
  info: OBPointsInfo | null;
  isRedeemModalOpen: boolean;
  setInfo: (info: OBPointsInfo) => void;
  setRedeemModalOpen: (open: boolean) => void;
  decrementBalance: (points: number) => void;
}

export const useOBPointsStore = create<OBPointsState>((set) => ({
  info: null,
  isRedeemModalOpen: false,
  setInfo: (info) => set({ info }),
  setRedeemModalOpen: (open) => set({ isRedeemModalOpen: open }),
  decrementBalance: (points) =>
    set((state) => ({
      info: state.info ? { ...state.info, balance: state.info.balance - points } : null,
    })),
}));
