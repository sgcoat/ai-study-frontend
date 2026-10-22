import { ApiError } from '../../../api/apiError';
import { API_MODE, apiTransport } from '../../../api/transport';
import type { AsyncJob, AsyncJobAccepted, Summary } from '../../../types';
import { summaryMockService } from '../mock/summaryMockService';
import { isJobAccepted, isSummary, type SummarySnapshot } from '../types';

function unwrap(response: unknown): unknown {
  return typeof response === 'object' && response !== null && 'data' in response ? response.data : response;
}

function invalidResponse(): ApiError {
  return new ApiError('서버의 요약 또는 작업 응답 형식을 확인해 주세요.', 'server', undefined, 'INVALID_SUMMARY_RESPONSE');
}

function normalizeSnapshot(response: unknown, materialId: string): SummarySnapshot {
  const data = unwrap(response);
  if (typeof data !== 'object' || data === null) throw invalidResponse();
  const payload = data as Record<string, unknown>;
  const items = Array.isArray(data) ? data : payload.items;
  if (!Array.isArray(items) || !items.every(isSummary) || items.some((item) => item.materialId !== materialId)) {
    throw invalidResponse();
  }
  const activeJob = payload.activeJob ?? null;
  if (activeJob !== null && !isJobAccepted(activeJob)) throw invalidResponse();
  return {
    summary: [...items].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0] ?? null,
    activeJob,
  };
}

export async function getSavedSummary(
  ownerId: string,
  materialId: string,
  signal?: AbortSignal,
): Promise<SummarySnapshot> {
  if (API_MODE === 'mock') return summaryMockService.list(ownerId, materialId);
  return normalizeSnapshot(await apiTransport.request<unknown>({
    method: 'GET',
    url: `/materials/${encodeURIComponent(materialId)}/summaries`,
    signal,
  }), materialId);
}

export async function requestSummaryJob(
  ownerId: string,
  materialId: string,
  requestKey: string,
): Promise<AsyncJobAccepted> {
  if (API_MODE === 'mock') return summaryMockService.start(ownerId, materialId, requestKey);
  const response = unwrap(await apiTransport.request<unknown>({
    method: 'POST',
    url: `/materials/${encodeURIComponent(materialId)}/summaries`,
    headers: { 'Idempotency-Key': requestKey },
    data: {},
  }));
  if (!isJobAccepted(response)) throw invalidResponse();
  return response;
}

export async function getSummaryJob(
  ownerId: string,
  jobId: string,
  materialId: string,
  signal?: AbortSignal,
): Promise<AsyncJob<Summary>> {
  if (API_MODE === 'mock') return summaryMockService.getJob(ownerId, jobId, materialId);
  const data = unwrap(await apiTransport.request<unknown>({
    method: 'GET',
    url: `/jobs/${encodeURIComponent(jobId)}`,
    signal,
  }));
  if (typeof data !== 'object' || data === null) throw invalidResponse();
  const job = data as Record<string, unknown>;
  if (job.jobId !== jobId || !['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'].includes(job.status as string)) {
    throw invalidResponse();
  }
  if (job.pollAfterMs !== undefined && (typeof job.pollAfterMs !== 'number' || !Number.isFinite(job.pollAfterMs))) {
    throw invalidResponse();
  }
  if (job.status === 'COMPLETED' && (!isSummary(job.result) || job.result.materialId !== materialId)) {
    throw invalidResponse();
  }
  if (job.status === 'FAILED' && (typeof job.error !== 'object' || job.error === null ||
    !('message' in job.error) || typeof job.error.message !== 'string')) {
    throw invalidResponse();
  }
  return data as AsyncJob<Summary>;
}
