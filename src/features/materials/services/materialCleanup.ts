import { Directory, File, Paths } from 'expo-file-system';
import { assertAccountDataAccess } from '../../../api/accountDataAccess';
import { readLocalJson, writeLocalJson } from '../../../api/localJson';
import { isQuizSession } from '../../questions/types';
import { useQuizStore } from '../../questions/store/quizStore';
import { useQuestionJobStore } from '../../questions/store/questionJobStore';
import { summarySessionKey, useSummaryJobStore } from '../../summaries/store/summaryJobStore';

const warning = '자료 변경은 완료했지만 기기의 이전 학습 정보 정리가 남아 있습니다. 기기 저장 공간을 확인한 뒤 다시 정리해 주세요.';

function assertScope(owner: string, material?: string): void {
  if (!owner || owner === '.' || owner === '..' || (material !== undefined && !/^[A-Za-z0-9_-]{1,160}$/.test(material))) {
    throw new Error('Invalid material scope');
  }
  assertAccountDataAccess(owner);
}

function marker(owner: string, material: string): File {
  assertScope(owner, material);
  const directory = new Directory(Paths.document, 'material-cleanups-v1', encodeURIComponent(owner));
  directory.create({ intermediates: true, idempotent: true });
  return new File(directory, `${encodeURIComponent(material)}.json`);
}

export function hasPendingMaterialCleanup(owner: string, material: string): boolean {
  try {
    assertScope(owner, material);
    return new File(Paths.document, 'material-cleanups-v1', encodeURIComponent(owner), `${encodeURIComponent(material)}.json`).exists;
  } catch { return true; }
}

export function cleanupMaterialLearningData(owner: string, material: string): string | null {
  try {
    const pending = marker(owner, material);
    writeLocalJson(pending, { materialId: material });
    const quizDirectory = new Directory(Paths.document, 'quiz-sessions-v1', encodeURIComponent(owner));
    const removedSets = new Set<string>();
    const removedFiles: File[] = [];
    for (const session of Object.values(useQuizStore.getState().sessions)) {
      if (session.ownerId === owner && session.materialId === material) removedSets.add(session.setId);
    }
    if (quizDirectory.exists) {
      for (const file of quizDirectory.list()) {
        if (!(file instanceof File) || !file.name.endsWith('.json') || file.name === 'index.json') continue;
        const value = readLocalJson(file);
        if (isQuizSession(value) && value.ownerId === owner && value.materialId === material) {
          removedSets.add(value.setId); removedFiles.push(file);
        }
      }
      const index = new File(quizDirectory, 'index.json');
      const value = readLocalJson(index);
      if (value !== null) {
        if (typeof value !== 'object' || Array.isArray(value) || !Object.values(value).every((id) => typeof id === 'string')) throw new Error('Invalid quiz index');
        writeLocalJson(index, Object.fromEntries(Object.entries(value).filter(([setId]) => !removedSets.has(setId))));
      }
    }
    useSummaryJobStore.getState().clearSession(owner, material);
    const questions = new Directory(Paths.document, 'question-jobs-v1', encodeURIComponent(owner), encodeURIComponent(material));
    if (questions.exists) questions.delete();
    for (const file of removedFiles) file.delete();
    useQuestionJobStore.setState((state) => ({ sessions: Object.fromEntries(Object.entries(state.sessions).filter(([key]) => {
      const scope = JSON.parse(key) as string[];
      return scope[0] !== owner || scope[1] !== material;
    })) }));
    useQuizStore.setState((state) => ({
      sessions: Object.fromEntries(Object.entries(state.sessions).filter(([, session]) => session.ownerId !== owner || session.materialId !== material)),
      latestSessions: Object.fromEntries(Object.entries(state.latestSessions).filter(([key, session]) => {
        const scope = JSON.parse(key) as string[];
        return scope[0] !== owner || ((scope[1] === undefined || !removedSets.has(scope[1])) && session?.materialId !== material);
      })),
    }));
    // Avoid a stale in-memory job being restored after its persisted file was removed.
    useSummaryJobStore.setState((state) => ({ sessions: { ...state.sessions, [summarySessionKey(owner, material)]: null } }));
    pending.delete();
    return null;
  } catch { return warning; }
}

export function retryPendingMaterialCleanups(owner: string): string | null {
  try {
    assertScope(owner);
    const directory = new Directory(Paths.document, 'material-cleanups-v1', encodeURIComponent(owner));
    if (!directory.exists) return null;
    let failed = false;
    for (const file of directory.list()) {
      if (!(file instanceof File) || !file.name.endsWith('.json')) continue;
      const value = readLocalJson(file);
      if (!value || typeof value !== 'object' || !('materialId' in value) || typeof value.materialId !== 'string' ||
          file.name !== `${encodeURIComponent(value.materialId)}.json`) { failed = true; continue; }
      if (cleanupMaterialLearningData(owner, value.materialId)) failed = true;
    }
    return failed ? warning : null;
  } catch { return warning; }
}
