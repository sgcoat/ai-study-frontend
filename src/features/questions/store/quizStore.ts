import { File } from 'expo-file-system';
import { create } from 'zustand';

import { ApiError } from '../../../api/apiError';
import { readLocalJson, scopedDirectory, writeLocalJson } from '../../../api/localJson';
import { isQuizSession, type QuestionSet, type QuizSession } from '../types';

export function quizKey(ownerId: string, id: string): string { return JSON.stringify([ownerId, id]); }

function sessionFile(ownerId: string, sessionId: string): File {
  return new File(scopedDirectory('quiz-sessions-v1', ownerId), `${encodeURIComponent(sessionId)}.json`);
}

function indexFile(ownerId: string): File { return new File(scopedDirectory('quiz-sessions-v1', ownerId), 'index.json'); }

function readIndex(ownerId: string): Record<string, string> {
  const value = readLocalJson(indexFile(ownerId));
  if (value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value) || !Object.values(value).every((id) => typeof id === 'string')) throw storageError();
  return value as Record<string, string>;
}

function storageError(): ApiError {
  return new ApiError('저장된 풀이를 읽거나 저장하지 못했습니다. 기기 저장 공간을 확인해 주세요.', 'unknown', undefined, 'QUIZ_STORAGE_ERROR');
}

interface QuizStore {
  sessions: Record<string, QuizSession>;
  latestSessions: Record<string, QuizSession | null>;
  loadSession: (ownerId: string, sessionId: string) => QuizSession;
  loadLatest: (ownerId: string, setId: string) => QuizSession | null;
  saveSession: (session: QuizSession) => void;
  createSession: (ownerId: string, set: QuestionSet) => QuizSession;
}

export const useQuizStore = create<QuizStore>((set, get) => ({
  sessions: {}, latestSessions: {},
  loadSession: (ownerId, sessionId) => {
    const cached = get().sessions[quizKey(ownerId, sessionId)];
    if (cached) return cached;
    try {
      const value = readLocalJson(sessionFile(ownerId, sessionId));
      if (!isQuizSession(value) || value.ownerId !== ownerId || value.id !== sessionId) throw storageError();
      set((state) => ({ sessions: { ...state.sessions, [quizKey(ownerId, sessionId)]: value } }));
      return value;
    } catch { throw storageError(); }
  },
  loadLatest: (ownerId, setId) => {
    const key = quizKey(ownerId, setId);
    const cached = get().latestSessions[key];
    if (cached !== undefined) return cached;
    try {
      const id = readIndex(ownerId)[setId];
      const session = id ? get().loadSession(ownerId, id) : null;
      if (session && session.setId !== setId) throw storageError();
      set((state) => ({ latestSessions: { ...state.latestSessions, [key]: session } }));
      return session;
    } catch { throw storageError(); }
  },
  saveSession: (session) => {
    try {
      writeLocalJson(sessionFile(session.ownerId, session.id), session);
      set((state) => ({
        sessions: { ...state.sessions, [quizKey(session.ownerId, session.id)]: session },
        latestSessions: state.latestSessions[quizKey(session.ownerId, session.setId)]?.id === session.id
          ? { ...state.latestSessions, [quizKey(session.ownerId, session.setId)]: session }
          : state.latestSessions,
      }));
    } catch { throw storageError(); }
  },
  createSession: (ownerId, questionSet) => {
    if (!ownerId) throw new ApiError('로그인이 필요합니다.', 'unauthorized', 401);
    const session: QuizSession = {
      id: `quiz-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`,
      ownerId, materialId: questionSet.materialId, setId: questionSet.id,
      questionIds: questionSet.questions.map((question) => question.id),
      currentIndex: 0, drafts: {}, attempts: {}, pending: null, createdAt: new Date().toISOString(),
    };
    try {
      get().saveSession(session);
      writeLocalJson(indexFile(ownerId), { ...readIndex(ownerId), [questionSet.id]: session.id });
      set((state) => ({ latestSessions: { ...state.latestSessions, [quizKey(ownerId, questionSet.id)]: session } }));
      return session;
    } catch { throw storageError(); }
  },
}));
