import { ApiError } from '../../../api/apiError';
import { API_MODE, apiTransport } from '../../../api/transport';
import type { LearningMaterial } from '../../../types';
import { materialMockService } from '../mock/materialMockService';
import {
  isLearningMaterial,
  type CreateMaterialInput,
  type MaterialListParams,
  type MaterialListResult,
  type UpdateMaterialInput,
} from '../types';

function unwrapResponse(response: unknown): unknown {
  if (typeof response === 'object' && response !== null && 'data' in response) {
    return response.data;
  }
  return response;
}

function invalidResponse(): ApiError {
  return new ApiError(
    '서버의 자료 응답 형식을 확인해 주세요.',
    'server',
    undefined,
    'INVALID_MATERIAL_RESPONSE',
  );
}

function normalizeMaterial(response: unknown): LearningMaterial {
  const data = unwrapResponse(response);
  if (!isLearningMaterial(data)) throw invalidResponse();
  return data;
}

function normalizeList(response: unknown): MaterialListResult {
  const data = unwrapResponse(response);
  if (typeof data !== 'object' || data === null) throw invalidResponse();
  const payload = data as Record<string, unknown>;
  const { items, pageInfo } = payload;
  if (!Array.isArray(items) || !items.every(isLearningMaterial)) throw invalidResponse();
  if (typeof pageInfo !== 'object' || pageInfo === null) throw invalidResponse();
  const page = pageInfo as Record<string, unknown>;
  if (
    !Number.isInteger(page.page) || (page.page as number) < 1 ||
    !Number.isInteger(page.pageSize) || (page.pageSize as number) < 1 ||
    !Number.isInteger(page.totalItems) || (page.totalItems as number) < 0 ||
    !Number.isInteger(page.totalPages) || (page.totalPages as number) < 0
  ) throw invalidResponse();

  const subjects = Array.isArray(payload.subjects) &&
    payload.subjects.every((subject: unknown) => typeof subject === 'string')
    ? payload.subjects as string[]
    : [...new Set(items.map((item) => item.subject))];

  return {
    items,
    pageInfo: {
      page: page.page as number,
      pageSize: page.pageSize as number,
      totalItems: page.totalItems as number,
      totalPages: page.totalPages as number,
    },
    subjects,
  };
}

export async function listMaterials(
  ownerId: string,
  params: MaterialListParams,
  signal?: AbortSignal,
): Promise<MaterialListResult> {
  if (API_MODE === 'mock') return materialMockService.list(ownerId, params);
  const response = await apiTransport.request<unknown>({
    method: 'GET',
    url: '/materials',
    params,
    signal,
  });
  return normalizeList(response);
}

export async function getMaterial(
  ownerId: string,
  materialId: string,
  signal?: AbortSignal,
): Promise<LearningMaterial> {
  if (API_MODE === 'mock') return materialMockService.getById(ownerId, materialId);
  const response = await apiTransport.request<unknown>({
    method: 'GET',
    url: `/materials/${encodeURIComponent(materialId)}`,
    signal,
  });
  return normalizeMaterial(response);
}

export async function createMaterial(
  ownerId: string,
  input: CreateMaterialInput,
): Promise<LearningMaterial> {
  if (API_MODE === 'mock') return materialMockService.create(ownerId, input);

  const formData = new FormData();
  formData.append('title', input.title);
  formData.append('subject', input.subject);
  formData.append('content', input.content);
  formData.append('isPublic', String(input.isPublic));
  for (const image of input.images) {
    // React Native accepts the native file descriptor as a FormData part.
    formData.append('images', {
      uri: image.uri,
      name: image.fileName,
      type: image.mimeType,
    } as unknown as Blob);
  }

  const response = await apiTransport.request<unknown>({
    method: 'POST',
    url: '/materials',
    data: formData,
    headers: input.requestKey ? { 'Idempotency-Key': input.requestKey } : undefined,
    // The native networking layer supplies the multipart boundary.
  });
  const material = normalizeMaterial(response);
  if (material.authorId !== ownerId) throw invalidResponse();
  return material;
}

export async function getMaterialRegistration(ownerId: string, key: string): Promise<LearningMaterial | null> {
  if (API_MODE === 'mock') return materialMockService.getRegistration(ownerId, key);
  try {
    const material = normalizeMaterial(await apiTransport.request<unknown>({ method: 'GET', url: `/materials/registrations/${encodeURIComponent(key)}` }));
    if (material.authorId !== ownerId) throw invalidResponse();
    return material;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      if (error.code === 'MATERIAL_REGISTRATION_NOT_FOUND') return null;
      throw new ApiError('등록 결과 확인 기능을 사용할 수 없어요. API 서버를 재시작한 뒤 다시 시도해 주세요.', 'server', undefined, 'MATERIAL_REGISTRATION_UNSUPPORTED');
    }
    throw error;
  }
}

export async function updateMaterial(ownerId: string, materialId: string, input: UpdateMaterialInput): Promise<LearningMaterial> {
  if (API_MODE === 'mock') return materialMockService.update(ownerId, materialId, input);
  const formData = new FormData();
  formData.append('title', input.title);
  formData.append('subject', input.subject);
  formData.append('content', input.content);
  formData.append('isPublic', String(input.isPublic));
  formData.append('expectedRevision', String(input.expectedRevision));
  formData.append('retainedImageIds', JSON.stringify(input.retainedImageIds));
  formData.append('resetStudyData', String(input.resetStudyData));
  for (const image of input.images) {
    formData.append('images', { uri: image.uri, name: image.fileName, type: image.mimeType } as unknown as Blob);
  }
  const material = normalizeMaterial(await apiTransport.request<unknown>({
    method: 'PATCH', url: `/materials/${encodeURIComponent(materialId)}`, data: formData,
  }));
  if (material.id !== materialId || material.authorId !== ownerId || material.revision === undefined || material.imageIds === undefined ||
      ![input.expectedRevision, input.expectedRevision + 1].includes(material.revision) ||
      material.title !== input.title || material.subject !== input.subject || material.content !== input.content || material.isPublic !== input.isPublic ||
      material.imageIds.length !== input.retainedImageIds.length + input.images.length ||
      input.retainedImageIds.some((id) => !material.imageIds!.includes(id))) throw invalidResponse();
  return material;
}

export async function deleteMaterial(ownerId: string, materialId: string, expectedRevision: number): Promise<void> {
  if (API_MODE === 'mock') return materialMockService.delete(ownerId, materialId, expectedRevision);
  try {
    await apiTransport.request<void>({ method: 'DELETE', url: `/materials/${encodeURIComponent(materialId)}`, data: { expectedRevision } });
  } catch (error) {
    // A lost DELETE response can be safely retried after the resource is already gone.
    if (error instanceof ApiError && error.status === 404) return;
    throw error;
  }
}
