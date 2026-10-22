import { ApiError } from '../../../api/apiError';
import type { AsyncJobAccepted, Summary } from '../../../types';
import { getSavedSummary, getSummaryJob, requestSummaryJob } from '../api/summariesApi';
import { summarySessionKey, useSummaryJobStore } from '../store/summaryJobStore';
import type { StartSummaryResult, SummaryJobSession } from '../types';

const requests = new Map<string, Promise<StartSummaryResult>>();

export function createSummaryRequestKey(): string {
  return `summary-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
}

export function shouldRememberActiveJob(
  job: AsyncJobAccepted | null | undefined,
  session: SummaryJobSession | null | undefined,
  snapshotUpdatedAt: number,
): boolean {
  if (!job || session === undefined || job.jobId === session?.jobId) return false;
  return !session || snapshotUpdatedAt > Date.parse(session.createdAt);
}

export function rememberSummaryJob(
  ownerId: string,
  materialId: string,
  job: AsyncJobAccepted,
  previous?: SummaryJobSession | null,
): void {
  useSummaryJobStore.getState().setSession(ownerId, materialId, {
    requestKey: previous?.requestKey ?? createSummaryRequestKey(),
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    jobId: job.jobId,
    pollAfterMs: job.pollAfterMs,
  });
}

export function clearCompletedSession(ownerId: string, materialId: string): void {
  try {
    useSummaryJobStore.getState().clearSession(ownerId, materialId);
  } catch {
    // The server already saved the summary. Cleanup must not hide a successful result.
  }
}

function savedResult(ownerId: string, materialId: string, summary: Summary): StartSummaryResult {
  clearCompletedSession(ownerId, materialId);
  return { kind: 'summary', summary };
}

async function run(ownerId: string, materialId: string, retryFailed: boolean): Promise<StartSummaryResult> {
  if (!ownerId) throw new ApiError('로그인이 필요합니다.', 'unauthorized', 401);
  const store = useSummaryJobStore.getState();
  const previous = store.loadSession(ownerId, materialId);
  // Confirm persisted results before every POST, even if UI cache says there is no summary.
  const snapshot = await getSavedSummary(ownerId, materialId);
  if (snapshot.summary) return savedResult(ownerId, materialId, snapshot.summary);
  if (snapshot.activeJob) {
    rememberSummaryJob(ownerId, materialId, snapshot.activeJob, previous);
    return { kind: 'job', job: snapshot.activeJob };
  }

  if (previous?.jobId) {
    const job = await getSummaryJob(ownerId, previous.jobId, materialId);
    if (job.status === 'COMPLETED') {
      if (!job.result) throw new ApiError('완료된 요약 결과를 확인할 수 없습니다.', 'server', undefined, 'SUMMARY_RESULT_MISSING');
      return savedResult(ownerId, materialId, job.result);
    }
    if (job.status === 'QUEUED' || job.status === 'PROCESSING') {
      return { kind: 'job', job: {
        jobId: job.jobId,
        status: job.status,
        pollAfterMs: job.pollAfterMs,
      } };
    }
    if (!retryFailed) {
      throw new ApiError(job.error?.message ?? '요약 생성에 실패했습니다. 다시 생성해 주세요.', 'server', undefined, 'SUMMARY_JOB_FAILED');
    }
  }

  const session: SummaryJobSession = previous && !previous.jobId
    ? previous
    : { requestKey: createSummaryRequestKey(), createdAt: new Date().toISOString() };
  store.setSession(ownerId, materialId, session);
  const job = await requestSummaryJob(ownerId, materialId, session.requestKey);
  rememberSummaryJob(ownerId, materialId, job, session);
  return { kind: 'job', job };
}

/** One in-flight generation request per user/material, including remounts and rapid taps. */
export function startSummary(ownerId: string, materialId: string, retryFailed = false): Promise<StartSummaryResult> {
  const key = summarySessionKey(ownerId, materialId);
  const existing = requests.get(key);
  if (existing) return existing;
  const promise = run(ownerId, materialId, retryFailed).finally(() => {
    if (requests.get(key) === promise) requests.delete(key);
  });
  requests.set(key, promise);
  return promise;
}
