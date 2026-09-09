import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';
import { useExpoRoom } from '@/hooks/useSocket';
import type { Booth, BoothUpdatedEvent, FloorPlanResponse } from '@/types';

export interface BoothGeometry {
  id?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export const boothKeys = {
  all: ['booths'] as const,
  byExpo: (expoId: string) => ['booths', 'expo', expoId] as const,
};

export function useFloorPlan(expoId: string | undefined) {
  return useQuery({
    queryKey: boothKeys.byExpo(expoId ?? ''),
    queryFn: () => http.get<FloorPlanResponse>(`/booths/expo/${expoId}`),
    enabled: Boolean(expoId),
  });
}

/**
 * keeps a floor plan query in sync with `booth:updated` broadcasts, so a
 * reservation made in another tab appears here with no refresh.
 *
 * the socket payload carries the whole booth, so the cache is patched directly
 * instead of refetching — the update lands in one frame.
 */
export function useLiveFloorPlan(expoId: string | undefined, onEvent?: (event: BoothUpdatedEvent) => void) {
  const queryClient = useQueryClient();

  const handler = useCallback(
    (event: BoothUpdatedEvent) => {
      queryClient.setQueryData<FloorPlanResponse>(boothKeys.byExpo(expoId ?? ''), (current) => {
        if (!current) return current;

        if (event.action === 'deleted') {
          return { ...current, items: current.items.filter((b) => b.id !== event.boothId) };
        }
        if (!event.booth) return current;

        const exists = current.items.some((b) => b.id === event.boothId);
        const items = exists
          ? current.items.map((b) => (b.id === event.boothId ? event.booth! : b))
          : [...current.items, event.booth];

        return { ...current, items: items.sort((a, b) => a.label.localeCompare(b.label)) };
      });

      onEvent?.(event);
    },
    [queryClient, expoId, onEvent]
  );

  // a whole-layout save is too broad to patch — refetch instead.
  const onLayoutSaved = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: boothKeys.byExpo(expoId ?? '') });
  }, [queryClient, expoId]);

  const { connected } = useExpoRoom<BoothUpdatedEvent>(expoId, 'booth:updated', handler);
  useExpoRoom<{ expoId: string }>(expoId, 'floorplan:updated', onLayoutSaved);

  return { connected };
}

/** bulk save of the whole canvas — what the builder's save button posts. */
export function useSaveLayout(expoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (booths: BoothGeometry[]) =>
      http.put<{ items: Booth[] }>(`/booths/expo/${expoId}/layout`, { booths }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boothKeys.byExpo(expoId) }),
  });
}

export function useReserveBooth(expoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (boothId: string) => http.patch<{ booth: Booth }>(`/booths/${boothId}/reserve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boothKeys.byExpo(expoId) }),
  });
}

export function useReleaseBooth(expoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (boothId: string) => http.patch<{ booth: Booth }>(`/booths/${boothId}/release`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boothKeys.byExpo(expoId) }),
  });
}

export function useAssignBooth(expoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ boothId, exhibitorRef }: { boothId: string; exhibitorRef: string }) =>
      http.patch<{ booth: Booth }>(`/booths/${boothId}/assign`, { exhibitorRef }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: boothKeys.byExpo(expoId) }),
  });
}
