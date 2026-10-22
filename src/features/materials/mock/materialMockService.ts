import { Directory, File, Paths } from 'expo-file-system';

import { ApiError } from '../../../api/apiError';
import { assertAccountDataAccess } from '../../../api/accountDataAccess';
import type { LearningMaterial } from '../../../types';
import {
  isLearningMaterial,
  type CreateMaterialInput,
  type MaterialListParams,
  type MaterialListResult,
  type UpdateMaterialInput,
} from '../types';
import { commitMockMaterialChange, removeMockImages } from './materialManagementStorage';

function getUserDirectory(ownerId: string): Directory {
  assertAccountDataAccess(ownerId);
  if (!ownerId || ownerId === '.' || ownerId === '..') throw new ApiError('로그인이 필요합니다.', 'unauthorized', 401);
  const directory = new Directory(
    Paths.document,
    'mock-materials-v1',
    encodeURIComponent(ownerId),
  );
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function createSampleMaterials(authorId: string): LearningMaterial[] {
  return [
    {
      id: 'sample-biology',
      authorId,
      subject: '생명과학',
      title: '세포 호흡과 ATP',
      content:
        '세포 호흡은 포도당에 저장된 에너지를 ATP 형태로 전환하는 과정이다.\n\n' +
        '1. 해당 과정: 세포질에서 포도당을 두 분자의 피루브산으로 분해한다.\n' +
        '2. 시트르산 회로: 미토콘드리아 기질에서 진행되며 이산화 탄소와 전자 운반체를 생성한다.\n' +
        '3. 산화적 인산화: 미토콘드리아 내막의 전자 전달계와 ATP 합성 효소를 이용한다.\n\n' +
        '산소는 전자 전달계의 최종 전자 수용체로 작용한다.',
      imagePaths: [],
      isPublic: false,
    },
    {
      id: 'sample-math',
      authorId,
      subject: '수학',
      title: '미분의 의미와 기본 공식',
      content:
        '미분계수는 한 점에서 함수의 순간 변화율이며, 그래프의 접선 기울기와 같다.\n\n' +
        'f\u2032(a) = lim(h → 0) [f(a + h) − f(a)] / h\n\n' +
        '거듭제곱 함수 f(x) = xⁿ의 도함수는 nxⁿ⁻¹이다.\n' +
        '상수 함수의 도함수는 0이다.\n' +
        '두 함수의 합은 각 함수의 도함수를 더하여 미분한다.',
      imagePaths: [],
      isPublic: false,
    },
    {
      id: 'sample-history',
      authorId,
      subject: '한국사',
      title: '조선 후기 사회 변화',
      content:
        '조선 후기에는 농업 생산력과 상품 화폐 경제가 발전했다.\n\n' +
        '모내기법의 확산으로 노동력이 절감되고 광작이 가능해졌다.\n' +
        '장시와 사상 활동이 활발해지면서 상업과 유통이 성장했다.\n' +
        '경제 변화에 따라 신분 질서도 동요했으며, 현실 문제 해결을 중시하는 실학이 발전했다.',
      imagePaths: [],
      isPublic: false,
    },
  ];
}

function readMaterials(directory: Directory, ownerId: string): LearningMaterial[] {
  const file = new File(directory, 'materials.json');
  if (!file.exists) {
    const samples = createSampleMaterials(ownerId);
    writeMaterials(directory, samples);
    return samples;
  }

  const data: unknown = JSON.parse(file.textSync());
  if (!Array.isArray(data) || !data.every(isLearningMaterial)) {
    throw new ApiError(
      '저장된 자료 형식을 읽을 수 없습니다.',
      'unknown',
      undefined,
      'INVALID_MOCK_MATERIALS',
    );
  }
  return data;
}

function writeMaterials(directory: Directory, materials: LearningMaterial[]): void {
  const temporary = new File(directory, 'materials.next.json');
  const destination = new File(directory, 'materials.json');
  // Finish writing before replacing the saved file so a failed write preserves it.
  temporary.write(JSON.stringify(materials));
  temporary.moveSync(destination, { overwrite: true });
}

function resolveLocalImages(
  material: LearningMaterial,
  directory: Directory,
): LearningMaterial {
  return {
    ...material,
    revision: material.revision ?? 1,
    imageIds: material.imagePaths,
    // Relative paths remain valid if the OS changes the app's document directory.
    imagePaths: material.imagePaths.map((path) => new File(directory, path).uri),
  };
}

function storageError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  return new ApiError(
    '기기에 자료를 저장하거나 읽지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.',
    'unknown',
    undefined,
    'LOCAL_STORAGE_ERROR',
  );
}

function registrationFile(ownerId: string, key: string): File {
  getUserDirectory(ownerId);
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(key)) throw new ApiError('등록 요청 식별자를 확인해 주세요.', 'validation', 422);
  const directory = new Directory(Paths.document, 'mock-material-registrations-v1', encodeURIComponent(ownerId));
  directory.create({ intermediates: true, idempotent: true });
  return new File(directory, `${encodeURIComponent(key)}.json`);
}

function readRegistration(owner: string, key: string): { materialId: string; fingerprint: string } | null {
  const file = registrationFile(owner, key);
  if (!file.exists) return null;
  const value = JSON.parse(file.textSync()) as { materialId?: unknown; fingerprint?: unknown };
  if (typeof value?.materialId !== 'string' || typeof value.fingerprint !== 'string') throw new ApiError('등록 결과를 읽지 못했습니다.', 'unknown');
  return value as { materialId: string; fingerprint: string };
}

function registrationMaterial(owner: string, key: string): LearningMaterial | null {
  const previous = readRegistration(owner, key);
  if (!previous) return null;
  const directory = getUserDirectory(owner);
  const material = readMaterials(directory, owner).find((item) => item.id === previous.materialId);
  if (!material) throw new ApiError('이 요청으로 등록한 자료는 이미 삭제되었습니다. 새 자료로 등록해 주세요.', 'http', 410, 'MATERIAL_ALREADY_DELETED');
  return resolveLocalImages(material, directory);
}

export const materialMockService = {
  async list(ownerId: string, params: MaterialListParams): Promise<MaterialListResult> {
    try {
      const directory = getUserDirectory(ownerId);
      const allMaterials = readMaterials(directory, ownerId);
      const query = params.query?.trim().toLocaleLowerCase() ?? '';
      const filtered = allMaterials.filter((material) => {
        const matchesSubject = !params.subject || material.subject === params.subject;
        const searchable = `${material.title} ${material.subject} ${material.content}`;
        return matchesSubject && searchable.toLocaleLowerCase().includes(query);
      });
      const offset = (params.page - 1) * params.pageSize;

      return {
        items: filtered
          .slice(offset, offset + params.pageSize)
          .map((material) => resolveLocalImages(material, directory)),
        pageInfo: {
          page: params.page,
          pageSize: params.pageSize,
          totalItems: filtered.length,
          totalPages: Math.ceil(filtered.length / params.pageSize),
        },
        subjects: [...new Set(allMaterials.map((material) => material.subject))].sort(),
      };
    } catch (error) {
      throw storageError(error);
    }
  },

  async getById(ownerId: string, materialId: string): Promise<LearningMaterial> {
    try {
      const directory = getUserDirectory(ownerId);
      const material = readMaterials(directory, ownerId).find(
        (item) => item.id === materialId,
      );
      if (!material) {
        throw new ApiError('자료를 찾을 수 없습니다.', 'not_found', 404);
      }
      return resolveLocalImages(material, directory);
    } catch (error) {
      throw storageError(error);
    }
  },

  async create(ownerId: string, input: CreateMaterialInput): Promise<LearningMaterial> {
    const copiedFiles: File[] = [];
    try {
      const directory = getUserDirectory(ownerId);
      readMaterials(directory, ownerId);
      const fingerprint = input.requestKey ? JSON.stringify([input.title, input.subject, input.content, input.isPublic,
        input.images.map((image) => {
          const digest = new File(image.uri).info({ md5: true }).md5;
          if (!digest) throw new ApiError('첨부 이미지를 읽지 못했습니다. 다시 선택해 주세요.', 'validation', 422);
          return [image.mimeType, digest];
        })]) : '';
      const replay = (): LearningMaterial | null => {
        if (!input.requestKey) return null;
        const previous = readRegistration(ownerId, input.requestKey);
        if (previous && previous.fingerprint !== fingerprint) throw new ApiError('같은 등록 요청의 내용은 바꿀 수 없습니다.', 'http', 409, 'IDEMPOTENCY_CONFLICT');
        return previous ? registrationMaterial(ownerId, input.requestKey) : null;
      };
      const existing = replay();
      if (existing) return existing;
      const imageDirectory = new Directory(directory, 'images');
      imageDirectory.create({ idempotent: true });
      const materialId = `material-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const imagePaths: string[] = [];
      for (const [index, image] of input.images.entries()) {
        const filename = `${materialId}-${index}.jpg`;
        const destination = new File(imageDirectory, filename);
        copiedFiles.push(destination);
        await new File(image.uri).copy(destination);
        imagePaths.push(`images/${filename}`);
      }
      const material: LearningMaterial = {
        id: materialId,
        authorId: ownerId,
        title: input.title,
        subject: input.subject,
        content: input.content,
        imagePaths,
        isPublic: input.isPublic,
        revision: 1,
      };
      const materials = readMaterials(directory, ownerId);
      assertAccountDataAccess(ownerId);
      const concurrent = replay();
      if (concurrent) {
        for (const file of copiedFiles) { try { if (file.exists) file.delete(); } catch { /* Unused copy. */ } }
        return concurrent;
      }
      commitMockMaterialChange(ownerId, materialId, [material, ...materials], false, input.requestKey ? [{
        file: registrationFile(ownerId, input.requestKey), value: { materialId, fingerprint },
      }] : []);
      return resolveLocalImages(material, directory);
    } catch (error) {
      for (const file of copiedFiles) {
        try {
          if (file.exists) file.delete();
        } catch {
          // Preserve the original save error if cleanup also fails.
        }
      }
      throw storageError(error);
    }
  },
  async getRegistration(ownerId: string, key: string): Promise<LearningMaterial | null> {
    try { return registrationMaterial(ownerId, key); } catch (error) { throw storageError(error); }
  },
  async update(ownerId: string, materialId: string, input: UpdateMaterialInput): Promise<LearningMaterial> {
    const copied: File[] = [];
    try {
      if (!/^[A-Za-z0-9_-]{1,160}$/.test(materialId)) throw new ApiError('자료를 확인해 주세요.', 'validation', 422);
      const directory = getUserDirectory(ownerId);
      const initial = readMaterials(directory, ownerId).find((item) => item.id === materialId);
      if (!initial) throw new ApiError('자료를 찾을 수 없습니다.', 'not_found', 404);
      const addedPaths: string[] = [];
      const imageDirectory = new Directory(directory, 'images');
      imageDirectory.create({ idempotent: true });
      for (const image of input.images) {
        const filename = `${materialId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
        const destination = new File(imageDirectory, filename);
        copied.push(destination);
        await new File(image.uri).copy(destination);
        addedPaths.push(`images/${filename}`);
      }
      assertAccountDataAccess(ownerId);
      const all = readMaterials(directory, ownerId);
      const current = all.find((item) => item.id === materialId);
      if (!current) throw new ApiError('자료를 찾을 수 없습니다.', 'not_found', 404);
      if ((current.revision ?? 1) !== input.expectedRevision) throw new ApiError('자료가 변경되었습니다. 최신 자료를 불러와 주세요.', 'http', 409, 'MATERIAL_CONFLICT');
      if (new Set(input.retainedImageIds).size !== input.retainedImageIds.length || input.retainedImageIds.some((id) => !current.imagePaths.includes(id))) throw new ApiError('유지할 이미지를 확인해 주세요.', 'validation', 422);
      const kept = current.imagePaths.filter((path) => input.retainedImageIds.includes(path));
      if (!input.title.trim() || !input.subject.trim() || (!input.content.trim() && !kept.length && !addedPaths.length) || kept.length + addedPaths.length > 10) throw new ApiError('제목·과목·필기 내용·이미지를 확인해 주세요.', 'validation', 422);
      const learningChanged = current.title !== input.title || current.subject !== input.subject || current.content !== input.content || kept.length !== current.imagePaths.length || addedPaths.length > 0;
      if (learningChanged && !input.resetStudyData) throw new ApiError('기존 요약·문제·풀이 기록 초기화를 확인해 주세요.', 'http', 409, 'MATERIAL_RESET_REQUIRED');
      if (!learningChanged && current.isPublic === input.isPublic) return resolveLocalImages(current, directory);
      const updated: LearningMaterial = { ...current, title: input.title, subject: input.subject, content: input.content, isPublic: input.isPublic,
        imagePaths: [...kept, ...addedPaths], revision: (current.revision ?? 1) + 1 };
      commitMockMaterialChange(ownerId, materialId, all.map((item) => item.id === materialId ? updated : item), learningChanged);
      removeMockImages(directory, current.imagePaths.filter((path) => !kept.includes(path)));
      return resolveLocalImages(updated, directory);
    } catch (error) {
      for (const file of copied) { try { if (file.exists) file.delete(); } catch { /* Temporary upload copy. */ } }
      throw storageError(error);
    }
  },
  async delete(ownerId: string, materialId: string, expectedRevision: number): Promise<void> {
    try {
      if (!/^[A-Za-z0-9_-]{1,160}$/.test(materialId)) throw new ApiError('자료를 확인해 주세요.', 'validation', 422);
      const directory = getUserDirectory(ownerId);
      const all = readMaterials(directory, ownerId);
      const current = all.find((item) => item.id === materialId);
      if (!current) return;
      if ((current.revision ?? 1) !== expectedRevision) throw new ApiError('자료가 변경되었습니다. 최신 자료를 불러와 주세요.', 'http', 409, 'MATERIAL_CONFLICT');
      commitMockMaterialChange(ownerId, materialId, all.filter((item) => item.id !== materialId), true);
      removeMockImages(directory, current.imagePaths);
    } catch (error) { throw storageError(error); }
  },
};
