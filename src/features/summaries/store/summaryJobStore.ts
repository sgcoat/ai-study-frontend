import { Directory, File, Paths } from 'expo-file-system';
import { create } from 'zustand';

import { ApiError } from '../../../api/apiError';
import { assertAccountDataAccess } from '../../../api/accountDataAccess';
import { isSummarySession, type SummaryJobSession } from '../types';

export function summarySessionKey(ownerId: string, materialId: string): string {
  return JSON.stringify([ownerId, materialId]);
}

function sessionFile(ownerId: string, materialId: string): File {
  assertAccountDataAccess(ownerId);
  const directory = new Directory(Paths.document, 'summary-sessions-v1', encodeURIComponent(ownerId));
  directory.create({ intermediates: true, idempotent: true });
  return new File(directory, `${encodeURIComponent(materialId)}.json`);
}

function persistenceError(): ApiError {
  return new ApiError('요약 작업 정보를 기기에서 읽거나 저장하지 못했습니다. 저장 공간을 확인해 주세요.', 'unknown', undefined, 'SUMMARY_SESSION_STORAGE_ERROR');
}

interface SummaryJobStore {
  sessions: Record<string, SummaryJobSession | null>;
  loadSession: (ownerId: string, materialId: string) => SummaryJobSession | null;
  setSession: (ownerId: string, materialId: string, session: SummaryJobSession) => void;
  clearSession: (ownerId: string, materialId: string) => void;
}

export const useSummaryJobStore = create<SummaryJobStore>((set, get) => ({
  sessions: {},
  loadSession: (ownerId, materialId) => {
    const key = summarySessionKey(ownerId, materialId);
    const cached = get().sessions[key];
    if (cached !== undefined) return cached;
    try {
      const file = sessionFile(ownerId, materialId);
      const data: unknown = file.exists ? JSON.parse(file.textSync()) : null;
      if (data !== null && !isSummarySession(data)) throw persistenceError();
      set((state) => ({ sessions: { ...state.sessions, [key]: data } }));
      return data;
    } catch {
      throw persistenceError();
    }
  },
  setSession: (ownerId, materialId, session) => {
    try {
      const file = sessionFile(ownerId, materialId);
      const temporary = new File(file.parentDirectory, `${encodeURIComponent(materialId)}.next.tmp`);
      temporary.write(JSON.stringify(session));
      temporary.moveSync(file, { overwrite: true });
      // Persist the request key before any paid generation request is sent.
      set((state) => ({ sessions: { ...state.sessions, [summarySessionKey(ownerId, materialId)]: session } }));
    } catch {
      throw persistenceError();
    }
  },
  clearSession: (ownerId, materialId) => {
    try {
      const file = sessionFile(ownerId, materialId);
      if (file.exists) file.delete();
      set((state) => ({ sessions: { ...state.sessions, [summarySessionKey(ownerId, materialId)]: null } }));
    } catch {
      throw persistenceError();
    }
  },
}));
