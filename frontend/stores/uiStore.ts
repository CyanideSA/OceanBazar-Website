import { create } from 'zustand';

interface UIState {
  mobileMenuOpen: boolean;
  searchOpen: boolean;
  loginDialogOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setLoginDialogOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  mobileMenuOpen: false,
  searchOpen: false,
  loginDialogOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setLoginDialogOpen: (open) => set({ loginDialogOpen: open }),
}));
