import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';

import { ApiError, toApiError } from '../../../api/apiError';
import { useAppIsActive } from '../../../hooks/useAppIsActive';
import { useAuthStore } from '../../auth/store/authStore';
import { createMaterial, getMaterial, listMaterials } from '../api/materialsApi';
import type { CreateMaterialInput, MaterialListFilters } from '../types';
import { imageUrlRefreshInterval } from '../utils/imageUri';

export const materialKeys = {
  owner: (ownerId: string) => ['materials', ownerId] as const,
  list: (ownerId: string, filters: MaterialListFilters) =>
    ['materials', ownerId, 'list', filters] as const,
  detail: (ownerId: string, materialId: string) =>
    ['materials', ownerId, 'detail', materialId] as const,
};

function retryRead(failureCount: number, error: unknown): boolean {
  return failureCount < 1 && toApiError(error).retryable;
}

export function useMaterialsQuery(filters: MaterialListFilters) {
  const ownerId = useAuthStore((state) => state.user?.id) ?? '';
  return useInfiniteQuery({
    queryKey: materialKeys.list(ownerId, filters),
    queryFn: ({ pageParam, signal }) => listMaterials(
      ownerId,
      { ...filters, page: pageParam, pageSize: 12 },
      signal,
    ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.pageInfo.page < lastPage.pageInfo.totalPages
      ? lastPage.pageInfo.page + 1
      : undefined,
    enabled: Boolean(ownerId),
    staleTime: 30_000,
    retry: retryRead,
  });
}

export function useMaterialQuery(materialId: string) {
  const ownerId = useAuthStore((state) => state.user?.id) ?? '';
  const focused = useIsFocused();
  const active = useAppIsActive();
  return useQuery({
    queryKey: materialKeys.detail(ownerId, materialId),
    queryFn: ({ signal }) => getMaterial(ownerId, materialId, signal),
    enabled: Boolean(ownerId && materialId && focused && active),
    staleTime: 30_000,
    retry: retryRead,
    refetchInterval: (query) => query.state.status === 'error' ? false : imageUrlRefreshInterval(query.state.data?.imagePaths),
    refetchIntervalInBackground: false,
  });
}

export function useCreateMaterialMutation() {
  const ownerId = useAuthStore((state) => state.user?.id) ?? '';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateMaterialInput) => {
      if (!ownerId) throw new ApiError('로그인이 필요합니다.', 'unauthorized', 401);
      return createMaterial(ownerId, input);
    },
    // A POST is never retried automatically, avoiding duplicate materials.
    retry: false,
    onSuccess: (material) => {
      queryClient.setQueryData(materialKeys.detail(ownerId, material.id), material);
      void queryClient.invalidateQueries({ queryKey: materialKeys.owner(ownerId) });
    },
  });
}
