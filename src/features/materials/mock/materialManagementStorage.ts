import { Directory, File, Paths } from 'expo-file-system';
import { ApiError } from '../../../api/apiError';
import { assertAccountDataAccess } from '../../../api/accountDataAccess';
import type { LearningMaterial } from '../../../types';

function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.every((item) => item && typeof item === 'object' && !Array.isArray(item))) {
    throw new ApiError('저장된 학습 데이터를 읽지 못했습니다. 기기 저장 공간을 확인해 주세요.', 'unknown');
  }
  return value;
}

// Stage all affected JSON files before replacing any; recover completed replacements on a write error.
export function commitMockMaterialChange(owner: string, materialId: string, materials: LearningMaterial[], reset: boolean,
  extra: { file: File; value: unknown }[] = []): void {
  assertAccountDataAccess(owner);
  const changes: { file: File; value: unknown }[] = [{
    file: new File(Paths.document, 'mock-materials-v1', encodeURIComponent(owner), 'materials.json'), value: materials,
  }, ...extra];
  if (reset) {
    for (const namespace of ['mock-summaries-v1', 'mock-questions-v1']) {
      const file = new File(Paths.document, namespace, encodeURIComponent(owner), 'state.json');
      if (!file.exists) continue;
      const state = JSON.parse(file.textSync()) as Record<string, unknown>;
      const jobs = rows(state.jobs);
      if (jobs.some((job) => job.materialId === materialId && ['QUEUED', 'PROCESSING'].includes(String(job.status)) &&
          (typeof job.finishAt !== 'number' || job.finishAt > Date.now()))) {
        throw new ApiError('이 자료의 생성이 진행 중입니다. 완료된 뒤 다시 시도해 주세요.', 'http', 409, 'MATERIAL_BUSY');
      }
      const next: Record<string, unknown> = { ...state, jobs: jobs.filter((job) => job.materialId !== materialId) };
      if (namespace === 'mock-summaries-v1') next.summaries = rows(state.summaries).filter((summary) => summary.materialId !== materialId);
      else {
        const removedIds = new Set(rows(state.solutions).filter((question) => question.materialId === materialId).map((question) => question.id));
        next.sets = rows(state.sets).filter((set) => set.materialId !== materialId);
        next.solutions = rows(state.solutions).filter((question) => question.materialId !== materialId);
        next.attempts = rows(state.attempts).filter((attempt) => !removedIds.has(attempt.questionId));
      }
      changes.push({ file, value: next });
    }
  }
  const staged = changes.map(({ file, value }) => ({ file, value, previous: file.exists ? file.textSync() : null,
    temporary: new File(file.parentDirectory, `${file.name}.manage.tmp`) }));
  const temporaryPaths = staged.map((item) => item.temporary.uri);
  const committed: typeof staged = [];
  try {
    for (const item of staged) item.temporary.write(JSON.stringify(item.value));
    for (const item of staged) { item.temporary.moveSync(item.file, { overwrite: true }); committed.push(item); }
  } catch (error) {
    for (const item of committed.reverse()) {
      try { if (item.previous === null) item.file.delete(); else item.file.write(item.previous); } catch { /* Preserve the storage failure. */ }
    }
    throw error;
  } finally {
    // moveSync changes the source File's URI to the destination. Keep the original temp path.
    for (const path of temporaryPaths) { try { const file = new File(path); if (file.exists) file.delete(); } catch { /* Temporary local file. */ } }
  }
}

export function removeMockImages(directory: Directory, paths: string[]): void {
  for (const path of paths) {
    if (!/^images\/[a-zA-Z0-9_-]+\.jpg$/.test(path)) continue;
    try { const file = new File(directory, path); if (file.exists) file.delete(); } catch { /* The removed file is no longer referenced. */ }
  }
}
