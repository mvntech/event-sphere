import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';
import type { Registration } from '@/types';

export const registrationKeys = {
  all: ['registrations'] as const,
  mine: (params: { expoRef?: string; bookmarked?: boolean }) => ['registrations', 'me', params] as const,
};

export function useMyRegistrations(params: { expoRef?: string; bookmarked?: boolean } = {}) {
  const search = new URLSearchParams();
  if (params.expoRef) search.set('expoRef', params.expoRef);
  if (params.bookmarked) search.set('bookmarked', 'true');
  const qs = search.toString();

  return useQuery({
    queryKey: registrationKeys.mine(params),
    queryFn: () => http.get<{ items: Registration[] }>(`/registrations/me${qs ? `?${qs}` : ''}`),
  });
}

export interface RegisterInput {
  expoRef: string;
  sessionRef?: string;
  bookmarked?: boolean;
}

/** capacity is enforced server-side; a full session comes back as a 409. */
export function useRegister() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) =>
      http.post<{ registration: Registration; seatsRemaining: number | null }>('/registrations', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: registrationKeys.all });
      // seat counts on the schedule move too.
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}

export function useToggleBookmark() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, bookmarked }: { id: string; bookmarked: boolean }) =>
      http.patch<{ registration: Registration }>(`/registrations/${id}`, { bookmarked }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: registrationKeys.all }),
  });
}

export function useCancelRegistration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http.delete<{ registration: Registration }>(`/registrations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: registrationKeys.all });
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
    },
  });
}
