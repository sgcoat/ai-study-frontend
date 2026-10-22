import { File } from 'expo-file-system';
import { create } from 'zustand';

import { ApiError } from '../../../api/apiError';
import { readLocalJson, scopedDirectory, writeLocalJson } from '../../../api/localJson';
import { isQuestionConfig, isQuestionJobSession, questionConfigKey, type QuestionGenerationConfig, type QuestionJobSession } from '../types';

export function questionSessionKey(ownerId: string, materialId: string, config: QuestionGenerationConfig): string {
  return JSON.stringify([ownerId, materialId, questionConfigKey(config)]);
}

function sessionFile(ownerId: string, materialId: string, config: QuestionGenerationConfig): File {
  return new File(scopedDirectory('question-jobs-v1', ownerId, materialId, config.summaryId), `${[...config.types].sort().join('_')}-${config.count}.json`);
}

function storageError(): ApiError {
  return new ApiError('문제 생성 작업 정보를 읽거나 저장하지 못했습니다. 기기 저장 공간을 확인해 주세요.', 'unknown', undefined, 'QUESTION_JOB_STORAGE_ERROR');
}

interface QuestionJobStore {
  sessions: Record<string, QuestionJobSession | null>;
  loadSession: (ownerId: string, materialId: string, config: QuestionGenerationConfig) => QuestionJobSession | null;
  setSession: (ownerId: string, materialId: string, config: QuestionGenerationConfig, session: QuestionJobSession) => void;
  clearSession: (ownerId: string, materialId: string, config: QuestionGenerationConfig) => void;
  loadPreference: (ownerId: string, materialId: string) => QuestionGenerationConfig | null;
  setPreference: (ownerId: string, materialId: string, config: QuestionGenerationConfig) => void;
}

export const useQuestionJobStore = create<QuestionJobStore>((set, get) => ({
  sessions: {},
  loadSession: (ownerId, materialId, config) => {
    const key = questionSessionKey(ownerId, materialId, config);
    const cached = get().sessions[key];
    if (cached !== undefined) return cached;
    try {
      const value = readLocalJson(sessionFile(ownerId, materialId, config));
      if (value !== null && !isQuestionJobSession(value)) throw storageError();
      set((state) => ({ sessions: { ...state.sessions, [key]: value } }));
      return value;
    } catch { throw storageError(); }
  },
  setSession: (ownerId, materialId, config, session) => {
    try {
      writeLocalJson(sessionFile(ownerId, materialId, config), session);
      set((state) => ({ sessions: { ...state.sessions, [questionSessionKey(ownerId, materialId, config)]: session } }));
    } catch { throw storageError(); }
  },
  clearSession: (ownerId, materialId, config) => {
    try {
      const file = sessionFile(ownerId, materialId, config);
      if (file.exists) file.delete();
      set((state) => ({ sessions: { ...state.sessions, [questionSessionKey(ownerId, materialId, config)]: null } }));
    } catch { throw storageError(); }
  },
  loadPreference: (ownerId, materialId) => {
    try {
      const value = readLocalJson(new File(scopedDirectory('question-jobs-v1', ownerId, materialId), 'preference.json'));
      if (value !== null && !isQuestionConfig(value)) throw storageError();
      return value;
    } catch { throw storageError(); }
  },
  setPreference: (ownerId, materialId, config) => {
    try {
      writeLocalJson(new File(scopedDirectory('question-jobs-v1', ownerId, materialId), 'preference.json'), config);
    } catch { throw storageError(); }
  },
}));
