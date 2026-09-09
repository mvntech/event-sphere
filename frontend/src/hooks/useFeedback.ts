import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';
import type { Feedback, FeedbackCategory, FeedbackStatus } from '@/types';

export const feedbackKeys = {
  all: ['feedback'] as const,
  inbox: (params: { expoRef?: string; status?: FeedbackStatus }) => ['feedback', 'inbox', params] as const,
  mine: ['feedback', 'mine'] as const,
};

export interface FeedbackInput {
  expoRef?: string;
  content: string;
  category: FeedbackCategory;
  rating?: number;
}

export function useSubmitFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FeedbackInput) => http.post<{ feedback: Feedback }>('/feedback', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedbackKeys.all }),
  });
}

interface InboxResponse {
  items: Feedback[];
  counts: Record<FeedbackStatus, number>;
}

/** organizer inbox — the server scopes it to expos they run. */
export function useFeedbackInbox(params: { expoRef?: string; status?: FeedbackStatus } = {}) {
  const search = new URLSearchParams();
  if (params.expoRef) search.set('expoRef', params.expoRef);
  if (params.status) search.set('status', params.status);
  const qs = search.toString();

  return useQuery({
    queryKey: feedbackKeys.inbox(params),
    queryFn: () => http.get<InboxResponse>(`/feedback${qs ? `?${qs}` : ''}`),
  });
}

export function useMyFeedback() {
  return useQuery({
    queryKey: feedbackKeys.mine,
    queryFn: () => http.get<{ items: Feedback[] }>('/feedback/me'),
  });
}

export function useUpdateFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string; status?: FeedbackStatus; organizerNote?: string }) =>
      http.patch<{ feedback: Feedback }>(`/feedback/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: feedbackKeys.all }),
  });
}
