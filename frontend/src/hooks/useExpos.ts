import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';
import type { Expo, ExpoStatus, Paginated } from '@/types';

export interface ExpoInput {
  title: string;
  description: string;
  theme?: string;
  location: string;
  startDate: string;
  endDate: string;
  status?: ExpoStatus;
}

interface ListParams {
  mine?: boolean;
  status?: ExpoStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export const expoKeys = {
  all: ['expos'] as const,
  list: (params: ListParams) => ['expos', 'list', params] as const,
  detail: (id: string) => ['expos', 'detail', id] as const,
};

function toQuery(params: ListParams) {
  const search = new URLSearchParams();
  if (params.mine) search.set('mine', 'true');
  if (params.status) search.set('status', params.status);
  if (params.search) search.set('search', params.search);
  if (params.page) search.set('page', String(params.page));
  if (params.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function useExpos(params: ListParams = {}) {
  return useQuery({
    queryKey: expoKeys.list(params),
    queryFn: () => http.get<Paginated<Expo>>(`/expos${toQuery(params)}`),
  });
}

export function useExpo(id: string | undefined) {
  return useQuery({
    queryKey: expoKeys.detail(id ?? ''),
    queryFn: () => http.get<{ expo: Expo; stats: { sessionCount: number; exhibitorCount: number } }>(`/expos/${id}`),
    enabled: Boolean(id),
  });
}

export function useCreateExpo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ExpoInput) => http.post<{ expo: Expo }>('/expos', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expoKeys.all }),
  });
}

export function useUpdateExpo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<ExpoInput> & { id: string }) =>
      http.patch<{ expo: Expo }>(`/expos/${id}`, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expoKeys.all }),
  });
}

export function useDeleteExpo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http.delete<{ id: string }>(`/expos/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expoKeys.all }),
  });
}
