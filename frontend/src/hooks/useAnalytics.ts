import { useMutation, useQuery } from '@tanstack/react-query';
import { http } from '@/lib/api';
import type { AnalyticsDashboard, AnalyticsEventType, AnalyticsLogEntry } from '@/types';

export const analyticsKeys = {
  summary: (expoId: string, days: number) => ['analytics', 'summary', expoId, days] as const,
  events: (expoId: string) => ['analytics', 'events', expoId] as const,
};

export function useAnalyticsSummary(expoId: string | undefined, days = 14) {
  return useQuery({
    queryKey: analyticsKeys.summary(expoId ?? '', days),
    queryFn: () => http.get<AnalyticsDashboard>(`/analytics/expo/${expoId}/summary?days=${days}`),
    enabled: Boolean(expoId),
  });
}

export function useAnalyticsEvents(expoId: string | undefined) {
  return useQuery({
    queryKey: analyticsKeys.events(expoId ?? ''),
    queryFn: () => http.get<{ items: AnalyticsLogEntry[] }>(`/analytics/expo/${expoId}/events?limit=30`),
    enabled: Boolean(expoId),
  });
}

/**
 * reports engagement that only happens in the browser — opening a booth on the
 * floor plan never reaches the API on its own.
 *
 * failures are swallowed: a dropped analytics event must never surface as an
 * error to someone just browsing.
 */
export function useRecordEvent() {
  return useMutation({
    mutationFn: (input: { expoRef: string; type: AnalyticsEventType; targetRef?: string }) =>
      http.post<{ recorded: boolean }>('/analytics/events', input),
    onError: () => undefined,
  });
}
