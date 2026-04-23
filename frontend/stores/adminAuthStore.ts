import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'staff';
}

interface State {
  token: string | null;
  admin: AdminUser | null;
  setSession: (token: string, admin: AdminUser) => void;
  logout: () => void;
}

export const useAdminAuthStore = create<State>()(
  persist(
    (set) => ({
      token: typeof window !== 'undefined' ? localStorage.getItem('oceanbazar_admin_token') : null,
      admin: null,
      setSession: (token, admin) => {
        if (typeof window !== 'undefined') localStorage.setItem('oceanbazar_admin_token', token);
        set({ token, admin });
      },
      logout: () => {
        if (typeof window !== 'undefined') localStorage.removeItem('oceanbazar_admin_token');
        set({ token: null, admin: null });
      },
    }),
    {
      name: 'ob-admin-auth',
      partialize: (s) => ({ token: s.token, admin: s.admin }),
    }
  )
);
