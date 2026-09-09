import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import { useAuthStore } from '@/store/authStore';
import type { AppNotification } from '@/types';

export const notificationKeys = {
  all: ['notifications'] as const,
};

interface NotificationsResponse {
  items: AppNotification[];
  unreadCount: number;
}

export function useNotifications() {
  const isAuthenticated = useAuthStore((s) => Boolean(s.accessToken));

  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: () => http.get<NotificationsResponse>('/notifications'),
    enabled: isAuthenticated,
    // sockets do the real work; this is a safety net if one drops.
    staleTime: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http.patch<{ notification: AppNotification }>(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => http.patch<{ updated: number }>('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  });
}

/**
 * pushes an arriving notification into the bell's cache immediately, so the
 * badge increments the moment the event lands rather than on the next poll.
 */
export function useLiveNotifications() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const handler = useCallback(
    (notification: AppNotification) => {
      queryClient.setQueryData<NotificationsResponse>(notificationKeys.all, (current) => {
        if (!current) return current;
        if (current.items.some((n) => n.id === notification.id)) return current;

        return {
          items: [notification, ...current.items].slice(0, 30),
          unreadCount: current.unreadCount + 1,
        };
      });
    },
    [queryClient]
  );

  useEffect(() => {
    if (!socket) return;
    socket.on('notification:new', handler);
    return () => {
      socket.off('notification:new', handler);
    };
  }, [socket, handler]);
}
