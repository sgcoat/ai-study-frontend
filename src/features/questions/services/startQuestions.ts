import { ApiError } from '../../../api/apiError';
import { getSavedSummary } from '../../summaries/api/summariesApi';
import { getQuestionJob, getQuestionSets, requestQuestionJob } from '../api/questionsApi';
import { questionSessionKey, useQuestionJobStore } from '../store/questionJobStore';
import { isQuestionConfig, sameQuestionConfig, type ActiveQuestionJob, type QuestionGenerationConfig, type QuestionJobSession, type StartQuestionResult } from '../types';

const requests = new Map<string, Promise<StartQuestionResult>>();
export function createQuestionRequestKey(): string { return `questions-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`; }

export function rememberQuestionJob(owner: string, material: string, config: QuestionGenerationConfig, job: ActiveQuestionJob, previous?: QuestionJobSession | null) {
  useQuestionJobStore.getState().setSession(owner, material, config, {
    requestKey: previous?.requestKey ?? createQuestionRequestKey(), createdAt: previous?.createdAt ?? new Date().toISOString(),
    jobId: job.jobId, pollAfterMs: job.pollAfterMs,
  });
}

export function clearQuestionSession(owner: string, material: string, config: QuestionGenerationConfig) {
  try { useQuestionJobStore.getState().clearSession(owner, material, config); } catch { /* A saved server result remains usable. */ }
}

async function run(owner: string, material: string, config: QuestionGenerationConfig, retryFailed: boolean): Promise<StartQuestionResult> {
  if (!owner) throw new ApiError('로그인이 필요합니다.', 'unauthorized', 401);
  if (!isQuestionConfig(config)) throw new ApiError('문제 유형과 문항 수를 확인해 주세요.', 'validation', 400);
  const store = useQuestionJobStore.getState();
  const previous = store.loadSession(owner, material, config);
  store.setPreference(owner, material, config);
  const snapshot = await getQuestionSets(owner, material);
  const saved = snapshot.sets.find((set) => sameQuestionConfig(set.config, config));
  if (saved) { clearQuestionSession(owner, material, config); return { kind: 'set', set: saved }; }
  const active = snapshot.activeJobs.find((job) => sameQuestionConfig(job.config, config));
  if (active) { rememberQuestionJob(owner, material, config, active, previous); return { kind: 'job', job: active }; }
  if (previous?.jobId) {
    const job = await getQuestionJob(owner, previous.jobId, material, config);
    if (job.status === 'COMPLETED' && job.result) {
      clearQuestionSession(owner, material, config); return { kind: 'set', set: job.result };
    }
    if (job.status === 'QUEUED' || job.status === 'PROCESSING') return { kind: 'job', job: { ...job, status: job.status, config } };
    if (job.status !== 'FAILED' || !retryFailed) throw new ApiError(job.error?.message ?? '문제 생성에 실패했습니다.', 'server', undefined, 'QUESTION_JOB_FAILED');
  }
  // Generation never creates a summary implicitly.
  const summary = await getSavedSummary(owner, material);
  if (summary.summary?.id !== config.summaryId) throw new ApiError('저장된 요약을 먼저 확인해 주세요.', 'validation', 400, 'SUMMARY_REQUIRED');
  const session = previous && !previous.jobId ? previous : { requestKey: createQuestionRequestKey(), createdAt: new Date().toISOString() };
  store.setSession(owner, material, config, session);
  const accepted = await requestQuestionJob(owner, material, config, session.requestKey);
  const job = { ...accepted, config };
  rememberQuestionJob(owner, material, config, job, session);
  return { kind: 'job', job };
}

export function startQuestions(owner: string, material: string, config: QuestionGenerationConfig, retryFailed = false): Promise<StartQuestionResult> {
  const key = questionSessionKey(owner, material, config);
  const existing = requests.get(key);
  if (existing) return existing;
  const promise = run(owner, material, config, retryFailed).finally(() => { if (requests.get(key) === promise) requests.delete(key); });
  requests.set(key, promise);
  return promise;
}
