import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';
import { useExpoRoom } from '@/hooks/useSocket';
import type { Session } from '@/types';

export interface SessionInput {
  title: string;
  speaker: string;
  topic: string;
  location: string;
  description?: string;
  startTime: string;
  endTime: string;
  capacity: number | null;
}

interface ScheduleResponse {
  items: Session[];
  expo: { id: string; title: string; startDate: string; endDate: string };
}

export const sessionKeys = {
  all: ['sessions'] as const,
  byExpo: (expoId: string) => ['sessions', 'expo', expoId] as const,
};

export function useSessions(expoId: string | undefined) {
  return useQuery({
    queryKey: sessionKeys.byExpo(expoId ?? ''),
    queryFn: () => http.get<ScheduleResponse>(`/sessions/expo/${expoId}`),
    enabled: Boolean(expoId),
  });
}

export interface ScheduleUpdatedEvent {
  sessionId: string;
  expoId: string;
  session: Session;
  action: 'created' | 'updated' | 'deleted';
  at: string;
}

/**
 * Keeps an open schedule in step with the organizer editing it.
 */
export function useLiveSchedule(expoId: string | undefined) {
  const queryClient = useQueryClient();

  const handler = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: sessionKeys.byExpo(expoId ?? '') });
  }, [queryClient, expoId]);

  return useExpoRoom<ScheduleUpdatedEvent>(expoId, 'schedule:updated', handler);
}

export function useCreateSession(expoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SessionInput) => http.post<{ session: Session }>('/sessions', { ...input, expoRef: expoId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.byExpo(expoId) }),
  });
}

export function useUpdateSession(expoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<SessionInput> & { id: string }) =>
      http.patch<{ session: Session }>(`/sessions/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.byExpo(expoId) }),
  });
}

export function useDeleteSession(expoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http.delete<{ id: string }>(`/sessions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionKeys.byExpo(expoId) }),
  });
}
