import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from '@/lib/api';
import type {
  ApprovalStatus,
  ExhibitorDocument,
  ExhibitorProduct,
  ExhibitorProfile,
  ExhibitorStaff,
  Pagination,
} from '@/types';

export interface ExhibitorContact {
  email?: string;
  phone?: string;
  website?: string;
}

export interface ApplicationInput {
  expoRef: string;
  companyName: string;
  description: string;
  category: string;
  contact: ExhibitorContact;
  products: ExhibitorProduct[];
  staff: ExhibitorStaff[];
  logo?: File | null;
  documents?: File[];
}

interface ListParams {
  expoRef?: string;
  approvalStatus?: ApprovalStatus;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

interface ExhibitorListResponse {
  items: ExhibitorProfile[];
  counts: Record<ApprovalStatus, number>;
  pagination: Pagination;
}

export const exhibitorKeys = {
  all: ['exhibitors'] as const,
  list: (params: ListParams) => ['exhibitors', 'list', params] as const,
  mine: ['exhibitors', 'mine'] as const,
  detail: (id: string) => ['exhibitors', 'detail', id] as const,
};

function toQuery(params: ListParams) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function useExhibitors(params: ListParams = {}) {
  return useQuery({
    queryKey: exhibitorKeys.list(params),
    queryFn: () => http.get<ExhibitorListResponse>(`/exhibitors${toQuery(params)}`),
  });
}

/** the signed-in exhibitor's own applications, across every expo. */
export function useMyApplications() {
  return useQuery({
    queryKey: exhibitorKeys.mine,
    queryFn: () => http.get<{ items: ExhibitorProfile[] }>('/exhibitors/me'),
  });
}

/** Packs the application into FormData — nested objects travel as JSON strings. */
function toFormData(input: ApplicationInput) {
  const form = new FormData();
  form.set('expoRef', input.expoRef);
  form.set('companyName', input.companyName);
  form.set('description', input.description);
  form.set('category', input.category);
  form.set('contact', JSON.stringify(input.contact));
  form.set('products', JSON.stringify(input.products));
  form.set('staff', JSON.stringify(input.staff));

  if (input.logo) form.set('logo', input.logo);
  input.documents?.forEach((file) => form.append('documents', file));

  return form;
}

export function useApplyAsExhibitor(onProgress?: (percent: number) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplicationInput) =>
      http.postForm<{ profile: ExhibitorProfile }>('/exhibitors', toFormData(input), onProgress),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exhibitorKeys.all }),
  });
}

export interface ProfilePatch {
  companyName?: string;
  description?: string;
  category?: string;
  contact?: ExhibitorContact;
  products?: ExhibitorProduct[];
  staff?: ExhibitorStaff[];
}

export function useUpdateExhibitorProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: ProfilePatch & { id: string }) =>
      http.patch<{ profile: ExhibitorProfile }>(`/exhibitors/${id}`, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exhibitorKeys.all }),
  });
}

/** Organizer decision on an application. */
export function useReviewExhibitor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approvalStatus, reviewNote }: { id: string; approvalStatus: 'approved' | 'rejected'; reviewNote: string }) =>
      http.patch<{ profile: ExhibitorProfile }>(`/exhibitors/${id}/status`, { approvalStatus, reviewNote }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exhibitorKeys.all }),
  });
}

export function useUploadLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.set('logo', file);
      return http.postForm<{ logoUrl: string }>(`/exhibitors/${id}/logo`, form);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exhibitorKeys.all }),
  });
}

export function useUploadDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, files }: { id: string; files: File[] }) => {
      const form = new FormData();
      files.forEach((file) => form.append('documents', file));
      return http.postForm<{ documents: ExhibitorDocument[] }>(`/exhibitors/${id}/documents`, form);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exhibitorKeys.all }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, documentId }: { id: string; documentId: string }) =>
      http.delete<{ documents: ExhibitorDocument[] }>(`/exhibitors/${id}/documents/${documentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: exhibitorKeys.all }),
  });
}
