import { useEffect, useState } from 'react';

import { toApiError } from '../../../api/apiError';
import { useAuthStore } from '../../auth/store/authStore';
import { validateQuizSession } from '../services/quizSession';
import { quizKey, useQuizStore } from '../store/quizStore';
import type { QuestionSet } from '../types';

export function useQuizSession(set: QuestionSet | undefined, sessionId: string) {
  const owner = useAuthStore((state) => state.user?.id) ?? '';
  const session = useQuizStore((state) => state.sessions[quizKey(owner, sessionId)]);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!set || !owner) return;
    try {
      const restored = useQuizStore.getState().loadSession(owner, sessionId);
      validateQuizSession(restored, owner, set);
      setError(null);
    } catch (failure) { setError(toApiError(failure).message); }
  }, [owner, set, sessionId, revision, session]);
  return { owner, session: error ? undefined : session, error, reload: () => setRevision((value) => value + 1) };
}
