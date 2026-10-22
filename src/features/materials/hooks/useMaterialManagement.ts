import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../../../api/apiError';
import { useAuthStore } from '../../auth/store/authStore';
import { deleteMaterial, updateMaterial } from '../api/materialsApi';
import { cleanupMaterialLearningData } from '../services/materialCleanup';
import type { UpdateMaterialInput } from '../types';
import { materialKeys } from './useMaterials';

export async function clearMaterialRelatedQueries(client: ReturnType<typeof useQueryClient>, owner: string, materialId: string): Promise<void> {
  const filter = { predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey[1] === owner &&
    (query.queryKey.includes(materialId) || ['summary-jobs', 'question-jobs'].includes(String(query.queryKey[0]))) };
  await client.cancelQueries(filter);
  client.removeQueries(filter);
}

export function useMaterialManagement(materialId: string) {
  const owner = useAuthStore((state) => state.user?.id) ?? '';
  const client = useQueryClient();
  const requireOwner = () => { if (!owner) throw new ApiError('로그인이 필요합니다.', 'unauthorized', 401); };
  const update = useMutation({
    mutationFn: async (input: UpdateMaterialInput) => {
      requireOwner();
      const material = await updateMaterial(owner, materialId, input);
      await clearMaterialRelatedQueries(client, owner, materialId);
      const cleanupWarning = input.resetStudyData ? cleanupMaterialLearningData(owner, materialId) : null;
      client.setQueryData(materialKeys.detail(owner, materialId), material);
      await client.invalidateQueries({ queryKey: materialKeys.owner(owner) });
      return { material, cleanupWarning };
    }, retry: false,
  });
  const remove = useMutation({
    mutationFn: async (expectedRevision: number) => {
      requireOwner();
      await deleteMaterial(owner, materialId, expectedRevision);
      await clearMaterialRelatedQueries(client, owner, materialId);
      const cleanupWarning = cleanupMaterialLearningData(owner, materialId);
      await client.invalidateQueries({ queryKey: materialKeys.owner(owner) });
      return { cleanupWarning };
    }, retry: false,
  });
  return { update, remove };
}
