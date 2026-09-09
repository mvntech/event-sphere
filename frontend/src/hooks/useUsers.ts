import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';
import type { ManagedUser, OrganizerApprovalStatus, Role, UserDirectory } from '@/types';

interface DirectoryParams {
  role?: Role;
  status?: 'pending' | 'rejected';
  search?: string;
}

export const userKeys = {
  all: ['users'] as const,
  directory: (params: DirectoryParams) => ['users', 'directory', params] as const,
};

function toQuery(params: DirectoryParams) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function useUserDirectory(params: DirectoryParams = {}) {
  return useQuery({
    queryKey: userKeys.directory(params),
    queryFn: () => http.get<UserDirectory>(`/users${toQuery(params)}`),
  });
}

/** approve or refuse a pending organizer account. */
export function useReviewOrganizer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      organizerApprovalStatus,
      reviewNote,
    }: {
      id: string;
      organizerApprovalStatus: Exclude<OrganizerApprovalStatus, 'pending'>;
      reviewNote?: string;
    }) => http.patch<{ user: ManagedUser }>(`/users/${id}/organizer-status`, { organizerApprovalStatus, reviewNote }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
}

export function useChangeRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) =>
      http.patch<{ user: ManagedUser }>(`/users/${id}/role`, { role }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  });
}
