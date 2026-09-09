import { useQuery } from '@tanstack/react-query';
import { http } from '@/lib/api';

export interface PublicStats {
  expos: number;
  exhibitors: number;
  attendees: number;
}

export const statsKeys = {
  all: ['stats'] as const,
  public: () => ['stats', 'public'] as const,
};

/**
 * Headline counts for the marketing pages.
 */
export function usePublicStats() {
  return useQuery({
    queryKey: statsKeys.public(),
    queryFn: () => http.get<PublicStats>('/stats/public'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
