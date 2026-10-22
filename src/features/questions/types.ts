import { QUESTION_TYPES, type AsyncJobAccepted, type QuestionPrompt, type QuestionType, type StudyRecord } from '../../types';

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: '객관식', SHORT_ANSWER: '주관식', OX: 'OX',
  CONCEPT_CHECK: '개념 확인', CONCEPT_COMPARISON: '개념 비교',
};

export interface QuestionGenerationConfig {
  summaryId: string;
  types: QuestionType[];
  count: number;
}

export interface QuestionSet {
  id: string;
  materialId: string;
  config: QuestionGenerationConfig;
  questions: QuestionPrompt[];
  createdAt: string;
  modelInfo: string;
}

export interface ActiveQuestionJob extends AsyncJobAccepted {
  config: QuestionGenerationConfig;
}

export interface QuestionSnapshot {
  sets: QuestionSet[];
  activeJobs: ActiveQuestionJob[];
}

export interface QuestionJobSession {
  requestKey: string;
  jobId?: string;
  pollAfterMs?: number;
  createdAt: string;
}

export interface QuestionAttemptResult {
  record: StudyRecord;
  correctAnswer: string;
  explanation: string;
}

export interface PendingQuizAnswer {
  questionId: string;
  submittedAnswer: string;
  requestKey: string;
}

export interface QuizSession {
  id: string;
  ownerId: string;
  materialId: string;
  setId: string;
  questionIds: string[];
  currentIndex: number;
  drafts: Record<string, string>;
  attempts: Record<string, QuestionAttemptResult>;
  pending: PendingQuizAnswer | null;
  createdAt: string;
  completedAt?: string;
}

export type StartQuestionResult = { kind: 'set'; set: QuestionSet } | { kind: 'job'; job: ActiveQuestionJob };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isQuestionConfig(value: unknown): value is QuestionGenerationConfig {
  if (!isRecord(value) || typeof value.summaryId !== 'string' || !value.summaryId) return false;
  return Array.isArray(value.types) && value.types.length > 0 && value.types.length <= QUESTION_TYPES.length &&
    value.types.every((type: unknown) => QUESTION_TYPES.includes(type as QuestionType)) &&
    new Set(value.types).size === value.types.length &&
    Number.isInteger(value.count) && (value.count as number) >= 1 && (value.count as number) <= 20;
}

export function questionConfigKey(config: QuestionGenerationConfig): string {
  return JSON.stringify([config.summaryId, [...config.types].sort(), config.count]);
}

export function sameQuestionConfig(a: QuestionGenerationConfig, b: QuestionGenerationConfig): boolean {
  return questionConfigKey(a) === questionConfigKey(b);
}

export function isQuestionPrompt(value: unknown): value is QuestionPrompt {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id ||
    typeof value.authorId !== 'string' || typeof value.materialId !== 'string' ||
    !QUESTION_TYPES.includes(value.type as QuestionType) || typeof value.content !== 'string' ||
    (value.source !== 'AI' && value.source !== 'USER')) return false;
  if (value.choices !== undefined && (!Array.isArray(value.choices) || !value.choices.every((choice: unknown) =>
    isRecord(choice) && typeof choice.id === 'string' && typeof choice.content === 'string' && choice.questionId === value.id))) return false;
  if (value.type === 'MULTIPLE_CHOICE') {
    return Array.isArray(value.choices) && value.choices.length >= 2 &&
      new Set(value.choices.map((choice: { id: string }) => choice.id)).size === value.choices.length;
  }
  return true;
}

export function isQuestionSet(value: unknown): value is QuestionSet {
  if (!isRecord(value) || typeof value.id !== 'string' || !value.id || typeof value.materialId !== 'string' ||
    !isQuestionConfig(value.config) || typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt)) ||
    typeof value.modelInfo !== 'string' || !Array.isArray(value.questions)) return false;
  const config = value.config;
  return value.questions.length === config.count && value.questions.every((question: unknown) =>
    isQuestionPrompt(question) && question.materialId === value.materialId && config.types.includes(question.type)) &&
    new Set(value.questions.map((question: QuestionPrompt) => question.id)).size === value.questions.length;
}

/** Copy only prompt fields, even if a draft backend accidentally includes solutions. */
export function toPublicQuestionSet(set: QuestionSet): QuestionSet {
  return { id: set.id, materialId: set.materialId, config: { summaryId: set.config.summaryId, types: [...set.config.types], count: set.config.count }, createdAt: set.createdAt, modelInfo: set.modelInfo,
    questions: set.questions.map((question) => ({
      id: question.id, authorId: question.authorId, materialId: question.materialId, type: question.type,
      content: question.content, source: question.source,
      choices: question.choices?.map((choice) => ({ id: choice.id, questionId: choice.questionId, content: choice.content })),
    })),
  };
}

export function isAttemptResult(value: unknown): value is QuestionAttemptResult {
  if (!isRecord(value) || typeof value.correctAnswer !== 'string' || typeof value.explanation !== 'string' || !isRecord(value.record)) return false;
  const record = value.record;
  return typeof record.id === 'string' && typeof record.userId === 'string' && typeof record.questionId === 'string' &&
    typeof record.submittedAnswer === 'string' && typeof record.isCorrect === 'boolean' &&
    typeof record.solvedTime === 'string' && Number.isFinite(Date.parse(record.solvedTime));
}

export function isQuestionJobSession(value: unknown): value is QuestionJobSession {
  return isRecord(value) && typeof value.requestKey === 'string' && value.requestKey.length > 0 &&
    typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt)) &&
    (value.jobId === undefined || (typeof value.jobId === 'string' && value.jobId.length > 0)) &&
    (value.pollAfterMs === undefined || (typeof value.pollAfterMs === 'number' && Number.isFinite(value.pollAfterMs)));
}

export function isQuizSession(value: unknown): value is QuizSession {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.ownerId !== 'string' || typeof value.materialId !== 'string' ||
    typeof value.setId !== 'string' || !Array.isArray(value.questionIds) || !value.questionIds.length ||
    !value.questionIds.every((id: unknown) => typeof id === 'string') || !Number.isInteger(value.currentIndex) ||
    (value.currentIndex as number) < 0 || (value.currentIndex as number) >= value.questionIds.length ||
    !isRecord(value.drafts) || !Object.values(value.drafts).every((draft) => typeof draft === 'string') ||
    !isRecord(value.attempts) || !Object.values(value.attempts).every(isAttemptResult) ||
    typeof value.createdAt !== 'string' || !Number.isFinite(Date.parse(value.createdAt))) return false;
  if (value.completedAt !== undefined && (typeof value.completedAt !== 'string' || !Number.isFinite(Date.parse(value.completedAt)))) return false;
  return value.pending === null || (isRecord(value.pending) && typeof value.pending.questionId === 'string' &&
    typeof value.pending.submittedAnswer === 'string' && value.pending.submittedAnswer.trim().length > 0 &&
    typeof value.pending.requestKey === 'string' && value.pending.requestKey.length > 0);
}
