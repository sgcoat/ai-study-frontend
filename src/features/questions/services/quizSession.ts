import { ApiError } from '../../../api/apiError';
import { submitQuestionAttempt } from '../api/questionsApi';
import { useQuizStore, quizKey } from '../store/quizStore';
import type { QuestionPrompt } from '../../../types';
import type { QuestionSet, QuizSession } from '../types';

const submissions = new Map<string, Promise<QuizSession>>();

export function validateQuizSession(session: QuizSession, owner: string, set: QuestionSet): void {
  if (session.ownerId !== owner || session.materialId !== set.materialId || session.setId !== set.id ||
    session.questionIds.length !== set.questions.length || session.questionIds.some((id, index) => id !== set.questions[index].id) ||
    Object.entries(session.attempts).some(([id, result]) => !session.questionIds.includes(id) || result.record.questionId !== id || result.record.userId !== owner) ||
    Object.keys(session.drafts).some((id) => !session.questionIds.includes(id)) ||
    (session.pending && (session.pending.questionId !== session.questionIds[session.currentIndex] || Boolean(session.attempts[session.pending.questionId]))) ||
    session.questionIds.slice(0, session.currentIndex).some((id) => !session.attempts[id]) ||
    Boolean(session.completedAt) !== session.questionIds.every((id) => Boolean(session.attempts[id]))) {
    throw new ApiError('저장된 풀이와 문제 구성이 일치하지 않습니다.', 'unknown', undefined, 'INVALID_QUIZ_SESSION');
  }
}

export function resumeOrCreateQuiz(owner: string, set: QuestionSet): QuizSession {
  const store = useQuizStore.getState();
  const latest = store.loadLatest(owner, set.id);
  if (latest) { validateQuizSession(latest, owner, set); return latest; }
  return store.createSession(owner, set);
}

export function answerLabel(question: QuestionPrompt, answer: string): string {
  return question.type === 'MULTIPLE_CHOICE' ? question.choices?.find((choice) => choice.id === answer)?.content ?? answer : answer;
}

export function saveQuizDraft(owner: string, set: QuestionSet, sessionId: string, answer: string, expectedQuestionId: string): void {
  const store = useQuizStore.getState();
  const session = store.loadSession(owner, sessionId);
  validateQuizSession(session, owner, set);
  const id = session.questionIds[session.currentIndex];
  if (id !== expectedQuestionId || session.pending || session.attempts[id]) return;
  store.saveSession({ ...session, drafts: { ...session.drafts, [id]: answer.slice(0, 5000) } });
}

async function submit(owner: string, set: QuestionSet, sessionId: string, answer: string): Promise<QuizSession> {
  const store = useQuizStore.getState();
  let session = store.loadSession(owner, sessionId);
  validateQuizSession(session, owner, set);
  const question = set.questions[session.currentIndex];
  if (session.attempts[question.id]) return session;
  // An uncertain POST is retried with its original answer and key.
  const submittedAnswer = session.pending?.submittedAnswer ?? answer.trim();
  if (!submittedAnswer || submittedAnswer.length > 5000 ||
    (question.type === 'MULTIPLE_CHOICE' && !question.choices?.some((choice) => choice.id === submittedAnswer)) ||
    (question.type === 'OX' && !['O', 'X'].includes(submittedAnswer))) throw new ApiError('답안을 입력하거나 선택해 주세요.', 'validation', 400);
  if (!session.pending) {
    session = { ...session, drafts: { ...session.drafts, [question.id]: submittedAnswer }, pending: {
      questionId: question.id, submittedAnswer, requestKey: `answer-${session.id}-${question.id}`,
    } };
    store.saveSession(session);
  }
  const pending = session.pending!;
  const result = await submitQuestionAttempt(owner, question.id, pending.submittedAnswer, pending.requestKey);
  const attempts = { ...session.attempts, [question.id]: result };
  const complete = session.questionIds.every((id) => Boolean(attempts[id]));
  const updated: QuizSession = { ...session, attempts, pending: null, completedAt: complete ? result.record.solvedTime : undefined };
  store.saveSession(updated);
  return updated;
}

export function submitQuizAnswer(owner: string, set: QuestionSet, sessionId: string, answer: string): Promise<QuizSession> {
  const key = quizKey(owner, sessionId);
  const existing = submissions.get(key);
  if (existing) return existing;
  const promise = submit(owner, set, sessionId, answer).finally(() => { if (submissions.get(key) === promise) submissions.delete(key); });
  submissions.set(key, promise);
  return promise;
}

export function nextQuizQuestion(owner: string, set: QuestionSet, sessionId: string): void {
  const store = useQuizStore.getState();
  const session = store.loadSession(owner, sessionId);
  validateQuizSession(session, owner, set);
  if (session.pending || !session.attempts[session.questionIds[session.currentIndex]] || session.currentIndex >= set.questions.length - 1) return;
  store.saveSession({ ...session, currentIndex: session.currentIndex + 1 });
}
