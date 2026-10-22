import { ApiError } from '../../../api/apiError';
import { API_MODE, apiTransport } from '../../../api/transport';
import type { AsyncJob, AsyncJobAccepted } from '../../../types';
import { isJobAccepted } from '../../summaries/types';
import { questionMockService } from '../mock/questionMockService';
import {
  isAttemptResult, isQuestionConfig, isQuestionSet, isRecord, sameQuestionConfig, toPublicQuestionSet,
  type ActiveQuestionJob, type QuestionAttemptResult, type QuestionGenerationConfig, type QuestionSet, type QuestionSnapshot,
} from '../types';

function unwrap(response: unknown): unknown {
  return isRecord(response) && 'data' in response ? response.data : response;
}

function invalidResponse(): ApiError {
  return new ApiError('서버의 문제 또는 채점 응답 형식을 확인해 주세요.', 'server', undefined, 'INVALID_QUESTION_RESPONSE');
}

export async function getQuestionSets(ownerId: string, materialId: string, signal?: AbortSignal): Promise<QuestionSnapshot> {
  if (API_MODE === 'mock') return questionMockService.list(ownerId, materialId);
  const data = unwrap(await apiTransport.request<unknown>({
    method: 'GET', url: `/materials/${encodeURIComponent(materialId)}/questions`, signal,
  }));
  if (!isRecord(data) || !Array.isArray(data.items) || !data.items.every(isQuestionSet) ||
    data.items.some((set) => set.materialId !== materialId) || !Array.isArray(data.activeJobs) ||
    !data.activeJobs.every((job: unknown) => isJobAccepted(job) && isRecord(job) && isQuestionConfig(job.config))) throw invalidResponse();
  return {
    sets: data.items.map(toPublicQuestionSet).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)),
    activeJobs: data.activeJobs as ActiveQuestionJob[],
  };
}

export async function requestQuestionJob(
  ownerId: string, materialId: string, config: QuestionGenerationConfig, requestKey: string,
): Promise<AsyncJobAccepted> {
  if (!isQuestionConfig(config)) throw new ApiError('문제 유형과 문항 수를 확인해 주세요.', 'validation', 400);
  if (API_MODE === 'mock') return questionMockService.start(ownerId, materialId, config, requestKey);
  const data = unwrap(await apiTransport.request<unknown>({
    method: 'POST', url: `/materials/${encodeURIComponent(materialId)}/questions/generate`,
    headers: { 'Idempotency-Key': requestKey }, data: { ...config, types: [...config.types].sort() },
  }));
  if (!isJobAccepted(data)) throw invalidResponse();
  return data;
}

export async function getQuestionJob(
  ownerId: string, jobId: string, materialId: string, config: QuestionGenerationConfig, signal?: AbortSignal,
): Promise<AsyncJob<QuestionSet>> {
  if (API_MODE === 'mock') return questionMockService.getJob(ownerId, jobId, materialId, config);
  const data = unwrap(await apiTransport.request<unknown>({ method: 'GET', url: `/jobs/${encodeURIComponent(jobId)}`, signal }));
  if (!isRecord(data) || data.jobId !== jobId || !['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(data.status as string) ||
    (data.pollAfterMs !== undefined && (typeof data.pollAfterMs !== 'number' || !Number.isFinite(data.pollAfterMs)))) throw invalidResponse();
  if (data.status === 'COMPLETED' && (!isQuestionSet(data.result) || data.result.materialId !== materialId ||
    !sameQuestionConfig(data.result.config, config))) throw invalidResponse();
  if (data.status === 'FAILED' && (!isRecord(data.error) || typeof data.error.message !== 'string')) throw invalidResponse();
  const job = data as unknown as AsyncJob<QuestionSet>;
  return { ...job, result: job.status === 'COMPLETED' && job.result ? toPublicQuestionSet(job.result) : undefined };
}

export async function submitQuestionAttempt(
  ownerId: string, questionId: string, submittedAnswer: string, requestKey: string,
): Promise<QuestionAttemptResult> {
  if (API_MODE === 'mock') return questionMockService.attempt(ownerId, questionId, submittedAnswer, requestKey);
  const data = unwrap(await apiTransport.request<unknown>({
    method: 'POST', url: `/questions/${encodeURIComponent(questionId)}/attempts`,
    headers: { 'Idempotency-Key': requestKey }, data: { submittedAnswer },
  }));
  if (!isAttemptResult(data) || data.record.userId !== ownerId || data.record.questionId !== questionId ||
    data.record.submittedAnswer !== submittedAnswer) throw invalidResponse();
  return data;
}
