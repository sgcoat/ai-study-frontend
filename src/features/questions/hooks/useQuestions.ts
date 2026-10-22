import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { toApiError } from '../../../api/apiError';
import { getJobPollInterval, isTerminalJob, MAX_JOB_MONITOR_MS } from '../../../api/asyncJobs';
import { useAppIsActive } from '../../../hooks/useAppIsActive';
import { useAuthStore } from '../../auth/store/authStore';
import { getQuestionJob, getQuestionSets } from '../api/questionsApi';
import { clearQuestionSession, rememberQuestionJob, startQuestions } from '../services/startQuestions';
import { questionSessionKey, useQuestionJobStore } from '../store/questionJobStore';
import { sameQuestionConfig, type QuestionGenerationConfig, type QuestionSet, type QuestionSnapshot } from '../types';

export const questionKeys = {
  snapshot: (owner: string, material: string) => ['questions', owner, material] as const,
  job: (owner: string, job: string) => ['question-jobs', owner, job] as const,
};
function retryRead(count: number, error: unknown) { return count < 1 && toApiError(error).retryable; }

export function useQuestionSets(materialId: string) {
  const owner = useAuthStore((state) => state.user?.id) ?? '';
  const focused = useIsFocused();
  const active = useAppIsActive();
  return useQuery({ queryKey: questionKeys.snapshot(owner, materialId),
    queryFn: ({ signal }) => getQuestionSets(owner, materialId, signal), enabled: Boolean(owner && materialId && focused && active),
    staleTime: 30_000, retry: retryRead, refetchOnWindowFocus: false });
}

export function cacheQuestionSet(client: ReturnType<typeof useQueryClient>, owner: string, set: QuestionSet) {
  client.setQueryData<QuestionSnapshot>(questionKeys.snapshot(owner, set.materialId), (previous) => ({
    sets: [set, ...(previous?.sets ?? []).filter((item) => item.id !== set.id)],
    activeJobs: (previous?.activeJobs ?? []).filter((job) => !sameQuestionConfig(job.config, set.config)),
  }));
}

export function useQuestionGeneration(materialId: string, config: QuestionGenerationConfig) {
  const owner = useAuthStore((state) => state.user?.id) ?? '';
  const focused = useIsFocused();
  const active = useAppIsActive();
  const client = useQueryClient();
  const sessionKey = questionSessionKey(owner, materialId, config);
  const session = useQuestionJobStore((state) => state.sessions[sessionKey]);
  const snapshot = useQuestionSets(materialId);
  const saved = snapshot.data?.sets.find((set) => sameQuestionConfig(set.config, config)) ?? null;
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [startedAt, setStartedAt] = useState(Date.now);
  const busy = useRef(false);

  const restore = () => {
    try { useQuestionJobStore.getState().loadSession(owner, materialId, config); setRestoreError(null); }
    catch (error) { setRestoreError(toApiError(error).message); }
  };
  useEffect(() => {
    if (!owner) return;
    try { useQuestionJobStore.getState().loadSession(owner, materialId, config); setRestoreError(null); }
    catch (error) { setRestoreError(toApiError(error).message); }
    // The key is canonical, so selecting the same types in a different order restores the same job.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, materialId, sessionKey]);

  useEffect(() => {
    if (!owner || session === undefined || restoreError || busy.current) return;
    if (saved) { if (session) clearQuestionSession(owner, materialId, config); return; }
    const job = snapshot.data?.activeJobs.find((item) => sameQuestionConfig(item.config, config));
    if (job && job.jobId !== session?.jobId && (!session || snapshot.dataUpdatedAt > Date.parse(session.createdAt))) {
      try { rememberQuestionJob(owner, materialId, config, job, session); }
      catch (error) { setRestoreError(toApiError(error).message); }
    }
  }, [owner, materialId, config, snapshot.data, snapshot.dataUpdatedAt, saved, session, restoreError, refreshing]);

  const jobId = session?.jobId ?? '';
  useEffect(() => { if (focused && active) setStartedAt(Date.now()); }, [focused, active, jobId, sessionKey]);
  const job = useQuery({
    queryKey: questionKeys.job(owner, jobId), queryFn: ({ signal }) => getQuestionJob(owner, jobId, materialId, config, signal),
    enabled: Boolean(owner && jobId && focused && active && !restoreError && !saved), staleTime: 0, retry: retryRead,
    retryOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
    refetchInterval: (query) => getJobPollInterval(query.state.data, query.state.status === 'error', startedAt, session?.pollAfterMs),
    refetchIntervalInBackground: false,
  });
  const questionSet = saved ?? (job.data?.status === 'COMPLETED' ? job.data.result ?? null : null);
  useEffect(() => {
    if (job.data?.status !== 'COMPLETED' || !job.data.result) return;
    cacheQuestionSet(client, owner, job.data.result);
    clearQuestionSession(owner, materialId, config);
  }, [client, owner, materialId, config, job.data]);

  const mutation = useMutation({ mutationFn: (retryFailed: boolean) => startQuestions(owner, materialId, config, retryFailed), retry: false,
    onSuccess: (result) => {
      setStartedAt(Date.now());
      if (result.kind === 'set') cacheQuestionSet(client, owner, result.set);
      else client.setQueryData<QuestionSnapshot>(questionKeys.snapshot(owner, materialId), (previous) => ({
        sets: previous?.sets ?? [], activeJobs: [result.job, ...(previous?.activeJobs ?? []).filter((item) => !sameQuestionConfig(item.config, config))],
      }));
    },
  });
  const generate = async (retryFailed = false) => {
    if (busy.current || questionSet || restoreError || session === undefined) return;
    busy.current = true; mutation.reset();
    try { await mutation.mutateAsync(retryFailed); } catch { /* Keep the persisted key for manual recovery. */ }
    finally { busy.current = false; }
  };
  const refresh = async () => {
    if (busy.current) return;
    busy.current = true; setRefreshing(true); setStartedAt(Date.now()); mutation.reset();
    try {
      const latest = await snapshot.refetch();
      if (!latest.data?.sets.some((set) => sameQuestionConfig(set.config, config)) && jobId) await job.refetch();
    } finally { busy.current = false; setRefreshing(false); }
  };
  return { questionSet, snapshot, job, session, restoreError, restore, mutation, generate, refresh, refreshing,
    monitoringPaused: Boolean(jobId && !isTerminalJob(job.data?.status) && Date.now() - startedAt >= MAX_JOB_MONITOR_MS) };
}
