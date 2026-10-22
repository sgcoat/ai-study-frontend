import type { AsyncJob, AsyncJobStatus } from '../types';

export const DEFAULT_JOB_POLL_MS = 2_000;
export const MAX_JOB_MONITOR_MS = 5 * 60_000;

export function isTerminalJob(status?: AsyncJobStatus): boolean {
  return status === 'COMPLETED' || status === 'FAILED';
}

export function clampJobPollMs(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_JOB_POLL_MS;
  return Math.min(15_000, Math.max(2_000, value ?? DEFAULT_JOB_POLL_MS));
}

export function getJobPollInterval<T>(
  job: AsyncJob<T> | undefined,
  hasError: boolean,
  monitoringStartedAt: number,
  suggestedMs?: number,
): number | false {
  if (hasError || isTerminalJob(job?.status)) return false;
  if (Date.now() - monitoringStartedAt >= MAX_JOB_MONITOR_MS) return false;
  return clampJobPollMs(job?.pollAfterMs ?? suggestedMs);
}
