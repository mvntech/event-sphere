import { useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { http, refreshSession } from '@/lib/api';
import type { AuthPayload, Role, User } from '@/types';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  role: Role;
  consentGiven: true;
}

export function useAuth() {
  const { user, status, accessToken, setSession, setUser, clear } = useAuthStore();

  const login = useCallback(
    async (email: string, password: string) => {
      const payload = await http.post<AuthPayload>('/auth/login', { email, password });
      setSession(payload);
      return payload.user;
    },
    [setSession]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      const payload = await http.post<AuthPayload & { pendingApproval?: boolean }>('/auth/register', input);

      // a new organizer is created without a session: the account is inert
      // until an existing organizer approves it. signing them
      // in here would hand them a workspace they are not entitled to yet.
      if (payload.pendingApproval) return { user: payload.user, pendingApproval: true as const };

      setSession(payload);
      return { user: payload.user, pendingApproval: false as const };
    },
    [setSession]
  );

  const logout = useCallback(async () => {
    try {
      await http.post('/auth/logout');
    } finally {
      clear();
    }
  }, [clear]);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<User, 'name' | 'avatarUrl'>> & { notificationPrefs?: { email: boolean } }) => {
      const { user: updated } = await http.patch<{ user: User }>('/users/me', patch);
      setUser(updated);
      return updated;
    },
    [setUser]
  );

  return {
    user,
    status,
    isAuthenticated: status === 'authenticated' && !!user,
    isLoading: status === 'idle' || status === 'loading',
    accessToken,
    login,
    register,
    logout,
    updateProfile,
  };
}

/**
 * restores the session from the refresh cookie on first mount, then keeps the
 * access token fresh on a timer so a user sitting idle on a page stays signed in.
 */
export function useSessionBootstrap() {
  const { status, expiresAt, setStatus } = useAuthStore();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');

    refreshSession()
      .catch(() => {
        // no valid cookie — a normal signed-out visit, not an error.
      })
      .finally(() => {
        if (!cancelled && useAuthStore.getState().status === 'loading') {
          useAuthStore.getState().clear();
        }
      });

    return () => {
      cancelled = true;
    };
    // runs once on app mount.
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (status !== 'authenticated' || !expiresAt) return;

    // renew a minute before expiry, never sooner than 5s from now.
    const delay = Math.max(expiresAt - Date.now() - 60_000, 5_000);
    timer.current = setTimeout(() => {
      refreshSession().catch(() => undefined);
    }, delay);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [status, expiresAt]);
}
