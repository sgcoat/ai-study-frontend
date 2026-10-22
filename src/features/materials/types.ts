import type { LearningMaterial, PaginatedResult } from '../../types';

export interface MaterialListFilters {
  query?: string;
  subject?: string;
}

export interface MaterialListParams extends MaterialListFilters {
  page: number;
  pageSize: number;
}

export interface MaterialListResult extends PaginatedResult<LearningMaterial> {
  /** All subjects owned by the user, before applying the current filters. */
  subjects: string[];
}

export interface LocalMaterialImage {
  id: string;
  uri: string;
  fileName: string;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
}

export interface CreateMaterialInput {
  title: string;
  subject: string;
  content: string;
  images: LocalMaterialImage[];
  isPublic: boolean;
  requestKey?: string;
}

export interface MaterialDraft extends CreateMaterialInput {
  id: string;
  ownerId: string;
  revision: number;
  updatedAt: string;
  submission: 'editing' | 'pending' | 'submitted';
  materialId?: string;
}

export interface UpdateMaterialInput extends CreateMaterialInput {
  expectedRevision: number;
  retainedImageIds: string[];
  resetStudyData: boolean;
}

export function isLearningMaterial(value: unknown): value is LearningMaterial {
  if (typeof value !== 'object' || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.authorId === 'string' &&
    typeof item.subject === 'string' &&
    typeof item.title === 'string' &&
    typeof item.content === 'string' &&
    typeof item.isPublic === 'boolean' &&
    (item.revision === undefined || (Number.isInteger(item.revision) && (item.revision as number) > 0)) &&
    Array.isArray(item.imagePaths) &&
    item.imagePaths.every((path: unknown) => typeof path === 'string') &&
    (item.imageIds === undefined || (Array.isArray(item.imageIds) && item.imageIds.length === item.imagePaths.length &&
      item.imageIds.every((id: unknown) => typeof id === 'string' && id.length > 0) && new Set(item.imageIds).size === item.imageIds.length))
  );
}
