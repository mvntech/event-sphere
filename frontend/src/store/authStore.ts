import { create } from 'zustand';
import type { User } from '@/types';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  expiresAt: number | null;
  status: AuthStatus;
  setSession: (payload: { user: User; accessToken: string; expiresIn: number }) => void;
  setUser: (user: User) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
}

/**
 * the access token lives in memory only. persistence across reloads comes from
 * the httpOnly refresh cookie, which JavaScript cannot read — so an XSS bug
 * can't walk off with a long-lived credential.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  expiresAt: null,
  status: 'idle',

  setSession: ({ user, accessToken, expiresIn }) =>
    set({ user, accessToken, expiresAt: Date.now() + expiresIn, status: 'authenticated' }),

  setUser: (user) => set({ user }),

  setStatus: (status) => set({ status }),

  clear: () => set({ user: null, accessToken: null, expiresAt: null, status: 'unauthenticated' }),
}));

export const authSelectors = {
  isAuthenticated: (s: AuthState) => s.status === 'authenticated' && !!s.user,
};
