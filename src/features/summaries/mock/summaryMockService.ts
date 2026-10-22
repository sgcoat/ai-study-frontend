import { Directory, File, Paths } from 'expo-file-system';
import { assertAccountDataAccess } from '../../../api/accountDataAccess';

import { ApiError } from '../../../api/apiError';
import type { AsyncJob, AsyncJobAccepted, AsyncJobStatus, LearningMaterial, Summary, SummaryTerm } from '../../../types';
import { materialMockService } from '../../materials/mock/materialMockService';
import { isSummary, type SummarySnapshot } from '../types';

interface MockJob {
  jobId: string;
  materialId: string;
  requestKey: string;
  status: AsyncJobStatus;
  createdAt: string;
  updatedAt: string;
  finishAt: number;
  shouldFail: boolean;
  source: Pick<LearningMaterial, 'title' | 'subject' | 'content'> & { imageCount: number };
  result?: Summary;
  error?: { code: string; message: string };
}

interface MockState {
  summaries: Summary[];
  jobs: MockJob[];
}

const configuredDelay = Number(process.env.EXPO_PUBLIC_MOCK_SUMMARY_DELAY_MS ?? 6000);
const mockDelay = Number.isFinite(configuredDelay) ? Math.max(1500, configuredDelay) : 6000;
const failOnce = process.env.EXPO_PUBLIC_MOCK_SUMMARY_FAIL_ONCE === 'true';

function getDirectory(ownerId: string): Directory {
  assertAccountDataAccess(ownerId);
  if (!ownerId) throw new ApiError('로그인이 필요합니다.', 'unauthorized', 401);
  const directory = new Directory(Paths.document, 'mock-summaries-v1', encodeURIComponent(ownerId));
  directory.create({ intermediates: true, idempotent: true });
  return directory;
}

function saveState(directory: Directory, state: MockState): void {
  const temporary = new File(directory, 'state.next.json');
  temporary.write(JSON.stringify(state));
  temporary.moveSync(new File(directory, 'state.json'), { overwrite: true });
}

function readState(directory: Directory): MockState {
  const file = new File(directory, 'state.json');
  if (!file.exists) return { summaries: [], jobs: [] };
  const data = JSON.parse(file.textSync()) as MockState;
  if (!Array.isArray(data.summaries) || !data.summaries.every(isSummary) || !Array.isArray(data.jobs)) {
    throw new ApiError('저장된 요약 데이터를 읽을 수 없습니다.', 'unknown', undefined, 'INVALID_MOCK_SUMMARIES');
  }
  return data;
}

function createExampleSummary(job: MockJob): Summary {
  const lines = job.source.content
    .split(/\n+/)
    .map((line) => line.trim().replace(/^\d+[.)]\s*/, ''))
    .filter(Boolean)
    .slice(0, 8)
    .map((line) => line.length > 400 ? `${line.slice(0, 400)}…` : line);
  const terms: SummaryTerm[] = [];
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon > 1 && colon < 30) {
      terms.push({ term: line.slice(0, colon).trim(), definition: line.slice(colon + 1).trim() });
    } else {
      const match = line.match(/^(.{2,20}?)(?:은|는|이란)\s+(.+)$/);
      if (match) terms.push({ term: match[1], definition: match[2] });
    }
  }
  const points = lines.length ? lines : [
    `이미지 ${job.source.imageCount}장이 등록되어 있습니다.`,
    '이 개발용 예시는 이미지 속 필기를 인식하지 않습니다. 실제 AI 요약은 백엔드 연결 후 제공됩니다.',
  ];
  return {
    id: `summary-${job.jobId}`,
    materialId: job.materialId,
    content: points.map((point) => `• ${point}`).join('\n'),
    modelInfo: 'mock-extractive-v1',
    createdAt: new Date(job.finishAt).toISOString(),
    structuredContent: {
      coreConcepts: points.slice(0, 3),
      keyTerms: terms.slice(0, 4),
      sections: [{ title: job.source.title, content: '', bulletPoints: points }],
    },
  };
}

function advanceJobs(directory: Directory): MockState {
  const state = readState(directory);
  const now = Date.now();
  let changed = false;
  for (const job of state.jobs) {
    if (job.status === 'COMPLETED' || job.status === 'FAILED') continue;
    if (now >= job.finishAt) {
      if (job.shouldFail) {
        job.status = 'FAILED';
        job.error = { code: 'MOCK_AI_FAILURE', message: '요약 생성에 실패했습니다. 다시 시도해 주세요.' };
      } else {
        job.status = 'COMPLETED';
        const existing = state.summaries.find((summary) => summary.materialId === job.materialId);
        job.result = existing ?? createExampleSummary(job);
        if (!existing) state.summaries.push(job.result);
      }
      job.updatedAt = new Date(now).toISOString();
      changed = true;
    } else if (now - Date.parse(job.createdAt) >= 1000 && job.status === 'QUEUED') {
      job.status = 'PROCESSING';
      job.updatedAt = new Date(now).toISOString();
      changed = true;
    }
  }
  if (changed) saveState(directory, state);
  return state;
}

function accepted(job: MockJob): AsyncJobAccepted {
  return {
    jobId: job.jobId,
    // Replayed requests can return a completed job ID; the next GET resolves it.
    status: job.status === 'PROCESSING' ? 'PROCESSING' : 'QUEUED',
    pollAfterMs: 2000,
  };
}

export const summaryMockService = {
  async list(ownerId: string, materialId: string): Promise<SummarySnapshot> {
    await materialMockService.getById(ownerId, materialId);
    const state = advanceJobs(getDirectory(ownerId));
    const job = state.jobs.find((item) => item.materialId === materialId &&
      (item.status === 'QUEUED' || item.status === 'PROCESSING'));
    return {
      summary: state.summaries.find((item) => item.materialId === materialId) ?? null,
      activeJob: job ? accepted(job) : null,
    };
  },

  async start(ownerId: string, materialId: string, requestKey: string): Promise<AsyncJobAccepted> {
    const material = await materialMockService.getById(ownerId, materialId);
    const directory = getDirectory(ownerId);
    const state = advanceJobs(directory);
    const replay = state.jobs.find((job) => job.requestKey === requestKey && job.materialId === materialId);
    if (replay) return accepted(replay);
    const reusable = state.jobs.find((job) => job.materialId === materialId && job.status !== 'FAILED');
    if (reusable) return accepted(reusable);

    const now = Date.now();
    const job: MockJob = {
      jobId: `summary-job-${now}-${Math.random().toString(36).slice(2, 10)}`,
      materialId,
      requestKey,
      status: 'QUEUED',
      createdAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
      finishAt: now + mockDelay,
      shouldFail: failOnce && !state.jobs.some((item) => item.materialId === materialId && item.shouldFail),
      source: { title: material.title, subject: material.subject, content: material.content, imageCount: material.imagePaths.length },
    };
    state.jobs.unshift(job);
    saveState(directory, state);
    return accepted(job);
  },

  async getJob(ownerId: string, jobId: string, materialId: string): Promise<AsyncJob<Summary>> {
    const state = advanceJobs(getDirectory(ownerId));
    const job = state.jobs.find((item) => item.jobId === jobId && item.materialId === materialId);
    if (!job) throw new ApiError('요약 작업을 찾을 수 없습니다.', 'not_found', 404);
    return {
      jobId: job.jobId,
      status: job.status,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      pollAfterMs: 2000,
    };
  },
};
