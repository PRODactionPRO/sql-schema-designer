import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  name?: string | null;
  role?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  setSession: (payload: { token: string; user: AuthUser }) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      setSession: ({ token, user }) => {
        set({ token, user, isAuthenticated: true });
      },
      clearSession: () => {
        set({ token: null, user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'sql-schema-designer-auth',
      storage: createJSONStorage(() => window.localStorage),
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);
