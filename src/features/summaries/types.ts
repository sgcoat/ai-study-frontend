import type { AsyncJobAccepted, StructuredSummaryContent, Summary } from '../../types';

export interface SummarySnapshot {
  summary: Summary | null;
  activeJob: AsyncJobAccepted | null;
}

export interface SummaryJobSession {
  requestKey: string;
  jobId?: string;
  pollAfterMs?: number;
  createdAt: string;
}

export type StartSummaryResult =
  | { kind: 'summary'; summary: Summary }
  | { kind: 'job'; job: AsyncJobAccepted };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStructuredContent(value: unknown): value is StructuredSummaryContent {
  if (!isRecord(value)) return false;
  return Array.isArray(value.coreConcepts) && value.coreConcepts.every((item: unknown) => typeof item === 'string') &&
    Array.isArray(value.keyTerms) && value.keyTerms.every((item: unknown) =>
      isRecord(item) && typeof item.term === 'string' && typeof item.definition === 'string') &&
    Array.isArray(value.sections) && value.sections.every((item: unknown) =>
      isRecord(item) && typeof item.title === 'string' && typeof item.content === 'string' &&
      (item.bulletPoints === undefined || (Array.isArray(item.bulletPoints) &&
        item.bulletPoints.every((point: unknown) => typeof point === 'string'))));
}

export function isSummary(value: unknown): value is Summary {
  return isRecord(value) && typeof value.id === 'string' &&
    typeof value.materialId === 'string' && typeof value.content === 'string' &&
    typeof value.modelInfo === 'string' && typeof value.createdAt === 'string' &&
    Number.isFinite(Date.parse(value.createdAt)) &&
    (value.structuredContent === undefined || isStructuredContent(value.structuredContent));
}

export function isJobAccepted(value: unknown): value is AsyncJobAccepted {
  return isRecord(value) && typeof value.jobId === 'string' && value.jobId.length > 0 &&
    (value.status === 'QUEUED' || value.status === 'PROCESSING') &&
    (value.pollAfterMs === undefined || (typeof value.pollAfterMs === 'number' && Number.isFinite(value.pollAfterMs)));
}

export function isSummarySession(value: unknown): value is SummaryJobSession {
  return isRecord(value) && typeof value.requestKey === 'string' && value.requestKey.length > 0 &&
    typeof value.createdAt === 'string' && Number.isFinite(Date.parse(value.createdAt)) &&
    (value.jobId === undefined || (typeof value.jobId === 'string' && value.jobId.length > 0)) &&
    (value.pollAfterMs === undefined || (typeof value.pollAfterMs === 'number' && Number.isFinite(value.pollAfterMs)));
}
