import { useMutation, useQuery } from '@tanstack/react-query';
import { http } from '@/lib/api';
import type {
  AiDescriptionResult,
  AiMatchResult,
  AiScheduleResult,
  AiSearchResult,
  AiSummaryResult,
  AiTriageResult,
} from '@/types';

export const aiKeys = {
  status: ['ai', 'status'] as const,
};

/** lets the UI hide AI affordances entirely when no key is configured. */
export function useAiStatus() {
  return useQuery({
    queryKey: aiKeys.status,
    queryFn: () => http.get<{ configured: boolean }>('/ai/status'),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAiSchedule() {
  return useMutation({
    mutationFn: (input: { expoRef: string; interests: string }) =>
      http.post<AiScheduleResult>('/ai/schedule', input),
  });
}

export function useAiMatch() {
  return useMutation({
    mutationFn: (input: { expoRef: string; interests: string }) => http.post<AiMatchResult>('/ai/match', input),
  });
}

export function useAiSearch() {
  return useMutation({
    mutationFn: (input: { expoRef: string; query: string }) => http.post<AiSearchResult>('/ai/search', input),
  });
}

export function useAiSummary() {
  return useMutation({
    mutationFn: (input: { expoRef: string }) => http.post<AiSummaryResult>('/ai/summarize', input),
  });
}

export function useAiDescription() {
  return useMutation({
    mutationFn: (input: { bulletPoints: string[]; companyName?: string; category?: string }) =>
      http.post<AiDescriptionResult>('/ai/generate-description', input),
  });
}

export function useAiTriage() {
  return useMutation({
    mutationFn: (input: { feedbackRef?: string; text?: string }) =>
      http.post<AiTriageResult>('/ai/triage-feedback', input),
  });
}
