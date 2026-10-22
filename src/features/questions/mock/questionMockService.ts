import { File } from 'expo-file-system';

import { ApiError } from '../../../api/apiError';
import { readLocalJson, scopedDirectory, writeLocalJson } from '../../../api/localJson';
import type { AsyncJob, AsyncJobStatus, Question, Summary } from '../../../types';
import { materialMockService } from '../../materials/mock/materialMockService';
import { summaryMockService } from '../../summaries/mock/summaryMockService';
import {
  isAttemptResult, isQuestionConfig, isQuestionSet, isRecord, sameQuestionConfig, toPublicQuestionSet,
  type ActiveQuestionJob, type QuestionAttemptResult, type QuestionGenerationConfig, type QuestionSet, type QuestionSnapshot,
} from '../types';

interface MockQuestionJob {
  jobId: string; materialId: string; requestKey: string; config: QuestionGenerationConfig;
  status: AsyncJobStatus; createdAt: string; finishAt: number; shouldFail: boolean;
  summary: Summary; title: string; result?: QuestionSet; error?: { code: string; message: string };
}
interface StoredAttempt { questionId: string; requestKey: string; answer: string; result: QuestionAttemptResult }
interface MockState { sets: QuestionSet[]; solutions: Question[]; jobs: MockQuestionJob[]; attempts: StoredAttempt[] }

const delay = Number(process.env.EXPO_PUBLIC_MOCK_QUESTION_DELAY_MS ?? 6000);
const mockDelay = Number.isFinite(delay) ? Math.max(1500, delay) : 6000;
const failOnce = process.env.EXPO_PUBLIC_MOCK_QUESTION_FAIL_ONCE === 'true';

function stateFile(ownerId: string): File {
  if (!ownerId) throw new ApiError('로그인이 필요합니다.', 'unauthorized', 401);
  return new File(scopedDirectory('mock-questions-v1', ownerId), 'state.json');
}

function readState(ownerId: string): MockState {
  try {
    const value = readLocalJson(stateFile(ownerId));
    if (value === null) return { sets: [], solutions: [], jobs: [], attempts: [] };
    if (!isRecord(value) || !Array.isArray(value.sets) || !value.sets.every(isQuestionSet) ||
      !Array.isArray(value.solutions) || !Array.isArray(value.jobs) || !Array.isArray(value.attempts) ||
      !value.attempts.every((item: unknown) => isRecord(item) && isAttemptResult(item.result))) throw new Error('Invalid state');
    return value as unknown as MockState;
  } catch { throw new ApiError('저장된 개발용 문제를 읽지 못했습니다.', 'unknown', undefined, 'MOCK_QUESTION_STORAGE_ERROR'); }
}

function examples(job: MockQuestionJob, ownerId: string): Question[] {
  const summary = job.summary;
  const points = summary.structuredContent?.coreConcepts.length ? summary.structuredContent.coreConcepts :
    summary.content.split('\n').map((line) => line.replace(/^•\s*/, '').trim()).filter(Boolean);
  const terms = summary.structuredContent?.keyTerms ?? [];
  return Array.from({ length: job.config.count }, (_, index) => {
    const type = job.config.types[index % job.config.types.length];
    const fact = points[index % Math.max(1, points.length)] ?? job.title;
    const term = terms[index % Math.max(1, terms.length)];
    const id = `${job.jobId}-q${index + 1}`;
    const base = { id, authorId: ownerId, materialId: job.materialId, type, source: 'AI' as const };
    if (type === 'MULTIPLE_CHOICE') {
      const texts = [fact, '이 자료에는 복습할 개념이 없다.', '요약 내용은 원본 자료와 관계가 없다.', '핵심 개념의 이해는 필요하지 않다.'];
      // Rotate the correct choice so it is not always the first option.
      const rotation = index % texts.length;
      const choices = texts.map((_, choiceIndex) => ({
        id: `${id}-c${choiceIndex + 1}`, questionId: id, content: texts[(choiceIndex + rotation) % texts.length],
      }));
      return { ...base, content: `「${job.title}」의 요약에 포함된 내용은 무엇인가요?`, choices,
        answer: choices.find((choice) => choice.content === fact)!.id,
        explanation: `요약에 제시된 내용은 다음과 같습니다.\n${fact}` };
    }
    if (type === 'OX') {
      const correct = index % 2 === 0;
      return { ...base, content: correct ? `다음 내용은 자료 요약에 포함되어 있다.\n${fact}` :
        `요약에서는 다음 내용의 반대가 사실이라고 설명한다.\n${fact}`,
      answer: correct ? 'O' : 'X', explanation: `요약에서 확인할 수 있는 내용: ${fact}` };
    }
    if (type === 'SHORT_ANSWER') {
      return { ...base, content: term ? `다음 설명에 해당하는 용어를 쓰세요.\n${term.definition}` :
        '요약의 다음 문장을 완성하세요. 아래 빈칸에 제시문의 내용을 그대로 쓰세요.\n[       ]\n제시문: ' + fact,
      answer: term?.term ?? fact, explanation: term ? `${term.term}: ${term.definition}` : fact };
    }
    if (type === 'CONCEPT_COMPARISON') {
      const other = terms.length > 1 ? terms[(index + 1) % terms.length] : null;
      return { ...base, content: term && other ? `「${term.term}」와 「${other.term}」를 비교해 설명하세요.` :
        '다음 두 내용을 비교해 설명하세요.\n① ' + fact + '\n② ' + (points[(index + 1) % Math.max(1, points.length)] ?? fact),
      answer: term && other ? `${term.term}: ${term.definition}\n${other.term}: ${other.definition}` :
        `${fact}\n${points[(index + 1) % Math.max(1, points.length)] ?? fact}`,
      explanation: '각 내용의 특징을 함께 확인해 보세요. 개발용 채점은 모범 답안과 문자가 일치하는지 확인합니다.' };
    }
    return { ...base, content: term ? `「${term.term}」의 의미를 설명하세요.` : '다음 핵심 내용을 다시 설명하세요.\n' + fact,
      answer: term?.definition ?? fact, explanation: term ? `${term.term}: ${term.definition}` : fact };
  });
}

function advance(ownerId: string): MockState {
  const state = readState(ownerId);
  let changed = false;
  for (const job of state.jobs) {
    if (job.status === 'COMPLETED' || job.status === 'FAILED') continue;
    if (Date.now() >= job.finishAt) {
      if (job.shouldFail) {
        job.status = 'FAILED';
        job.error = { code: 'MOCK_QUESTION_FAILURE', message: '문제 생성에 실패했습니다. 다시 시도해 주세요.' };
      } else {
        const existing = state.sets.find((set) => set.materialId === job.materialId && sameQuestionConfig(set.config, job.config));
        if (existing) job.result = existing;
        else {
          const questions = examples(job, ownerId);
          job.result = toPublicQuestionSet({ id: `set-${job.jobId}`, materialId: job.materialId, config: job.config,
            createdAt: new Date(job.finishAt).toISOString(), modelInfo: 'mock-questions-v1', questions });
          state.solutions.push(...questions);
          state.sets.unshift(job.result);
        }
        job.status = 'COMPLETED';
      }
      changed = true;
    } else if (Date.now() - Date.parse(job.createdAt) >= 1000 && job.status === 'QUEUED') {
      job.status = 'PROCESSING'; changed = true;
    }
  }
  if (changed) writeLocalJson(stateFile(ownerId), state);
  return state;
}

function accepted(job: MockQuestionJob): ActiveQuestionJob {
  return { jobId: job.jobId, status: job.status === 'PROCESSING' ? 'PROCESSING' : 'QUEUED', pollAfterMs: 2000, config: job.config };
}

export const questionMockService = {
  async list(ownerId: string, materialId: string): Promise<QuestionSnapshot> {
    await materialMockService.getById(ownerId, materialId);
    const state = advance(ownerId);
    return { sets: state.sets.filter((set) => set.materialId === materialId).map(toPublicQuestionSet),
      activeJobs: state.jobs.filter((job) => job.materialId === materialId && (job.status === 'QUEUED' || job.status === 'PROCESSING')).map(accepted) };
  },
  async start(ownerId: string, materialId: string, config: QuestionGenerationConfig, requestKey: string): Promise<ActiveQuestionJob> {
    if (!isQuestionConfig(config)) throw new ApiError('생성 조건을 확인해 주세요.', 'validation', 400);
    const material = await materialMockService.getById(ownerId, materialId);
    const snapshot = await summaryMockService.list(ownerId, materialId);
    if (!snapshot.summary || snapshot.summary.id !== config.summaryId) throw new ApiError('먼저 저장된 요약을 확인해 주세요.', 'validation', 400);
    const state = advance(ownerId);
    const replay = state.jobs.find((job) => job.requestKey === requestKey);
    if (replay) {
      if (replay.materialId !== materialId || !sameQuestionConfig(replay.config, config)) throw new ApiError('같은 요청 키의 조건이 다릅니다.', 'validation', 409);
      return accepted(replay);
    }
    const existing = state.jobs.find((job) => job.materialId === materialId && sameQuestionConfig(job.config, config) && job.status !== 'FAILED');
    if (existing) return accepted(existing);
    const now = Date.now();
    const job: MockQuestionJob = { jobId: `question-job-${now}-${Math.random().toString(36).slice(2, 10)}`,
      materialId, config: { ...config, types: [...config.types].sort() }, requestKey, status: 'QUEUED', createdAt: new Date(now).toISOString(),
      finishAt: now + mockDelay, shouldFail: failOnce && !state.jobs.some((item) => item.materialId === materialId && sameQuestionConfig(item.config, config) && item.shouldFail),
      summary: snapshot.summary, title: material.title };
    state.jobs.unshift(job);
    writeLocalJson(stateFile(ownerId), state);
    return accepted(job);
  },
  async getJob(ownerId: string, jobId: string, materialId: string, config: QuestionGenerationConfig): Promise<AsyncJob<QuestionSet>> {
    const job = advance(ownerId).jobs.find((item) => item.jobId === jobId && item.materialId === materialId && sameQuestionConfig(item.config, config));
    if (!job) throw new ApiError('문제 생성 작업을 찾을 수 없습니다.', 'not_found', 404);
    return { jobId, status: job.status, result: job.result ? toPublicQuestionSet(job.result) : undefined,
      error: job.error, createdAt: job.createdAt, pollAfterMs: 2000 };
  },
  async attempt(ownerId: string, questionId: string, submittedAnswer: string, requestKey: string): Promise<QuestionAttemptResult> {
    const state = advance(ownerId);
    const replay = state.attempts.find((item) => item.requestKey === requestKey);
    if (replay) {
      if (replay.questionId !== questionId || replay.answer !== submittedAnswer) throw new ApiError('제출한 답안을 바꿀 수 없습니다.', 'validation', 409);
      return replay.result;
    }
    const question = state.solutions.find((item) => item.id === questionId);
    if (!question) throw new ApiError('문제를 찾을 수 없습니다.', 'not_found', 404);
    if (!submittedAnswer.trim() || submittedAnswer.length > 5000 ||
      (question.type === 'OX' && !['O', 'X'].includes(submittedAnswer)) ||
      (question.type === 'MULTIPLE_CHOICE' && !question.choices?.some((choice) => choice.id === submittedAnswer))) {
      throw new ApiError('답안을 확인해 주세요.', 'validation', 400);
    }
    const normalize = (text: string) => text.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    const result: QuestionAttemptResult = {
      record: { id: `attempt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, userId: ownerId, questionId,
        submittedAnswer, isCorrect: normalize(submittedAnswer) === normalize(question.answer), solvedTime: new Date().toISOString() },
      correctAnswer: question.answer, explanation: question.explanation,
    };
    state.attempts.push({ questionId, requestKey, answer: submittedAnswer, result });
    writeLocalJson(stateFile(ownerId), state);
    return result;
  },
};
