import { useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';

import { toApiError } from '../../../api/apiError';
import type { MaterialsStackParamList } from '../../../navigation/types';
import { useAuthStore } from '../../auth/store/authStore';
import { resumeOrCreateQuiz } from '../services/quizSession';
import type { QuestionSet } from '../types';

export function useQuizLauncher(navigation: NativeStackNavigationProp<MaterialsStackParamList>) {
  const owner = useAuthStore((state) => state.user?.id) ?? '';
  const focused = useIsFocused();
  const busy = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (focused) { busy.current = false; setLoading(false); } }, [focused]);
  const open = (set: QuestionSet) => {
    if (busy.current) return;
    busy.current = true; setLoading(true); setError(null);
    try {
      const session = resumeOrCreateQuiz(owner, set);
      navigation.navigate(session.completedAt ? 'QuizResult' : 'QuizSolve', {
        materialId: set.materialId, setId: set.id, sessionId: session.id,
      });
    } catch (failure) { busy.current = false; setLoading(false); setError(toApiError(failure).message); }
  };
  return { open, error, loading };
}
