import { useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toApiError } from '../../../api/apiError';
import { getJobPollInterval, isTerminalJob, MAX_JOB_MONITOR_MS } from '../../../api/asyncJobs';
import { useAppIsActive } from '../../../hooks/useAppIsActive';
import { useAuthStore } from '../../auth/store/authStore';
import { getSavedSummary, getSummaryJob } from '../api/summariesApi';
import { clearCompletedSession, rememberSummaryJob, shouldRememberActiveJob, startSummary } from '../services/startSummary';
import { summarySessionKey, useSummaryJobStore } from '../store/summaryJobStore';
import type { SummarySnapshot } from '../types';

export const summaryKeys = {
  snapshot: (ownerId: string, materialId: string) => ['summaries', ownerId, materialId] as const,
  job: (ownerId: string, jobId: string) => ['summary-jobs', ownerId, jobId] as const,
};

function retryRead(failureCount: number, error: unknown) {
  return failureCount < 1 && toApiError(error).retryable;
}

export function useMaterialSummary(materialId: string) {
  const ownerId = useAuthStore((state) => state.user?.id) ?? '';
  const focused = useIsFocused();
  const appActive = useAppIsActive();
  const queryClient = useQueryClient();
  const key = summarySessionKey(ownerId, materialId);
  const session = useSummaryJobStore((state) => state.sessions[key]);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [monitoringStartedAt, setMonitoringStartedAt] = useState(Date.now);
  const actionInProgress = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const restoreSession = () => {
    if (!ownerId) return;
    try {
      useSummaryJobStore.getState().loadSession(ownerId, materialId);
      setRestoreError(null);
    } catch (error) {
      setRestoreError(toApiError(error).message);
    }
  };

  useEffect(() => {
    if (!ownerId) return;
    try {
      useSummaryJobStore.getState().loadSession(ownerId, materialId);
      setRestoreError(null);
    } catch (error) {
      setRestoreError(toApiError(error).message);
    }
  }, [ownerId, materialId]);

  const snapshot = useQuery({
    queryKey: summaryKeys.snapshot(ownerId, materialId),
    queryFn: ({ signal }) => getSavedSummary(ownerId, materialId, signal),
    enabled: Boolean(ownerId && materialId && focused && appActive),
    staleTime: 60_000,
    retry: retryRead,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!ownerId || session === undefined || restoreError || actionInProgress.current) return;
    if (snapshot.data?.summary) {
      if (session) clearCompletedSession(ownerId, materialId);
      return;
    }
    const activeJob = snapshot.data?.activeJob;
    // An older cached snapshot must not replace a newly persisted retry/request.
    if (activeJob && shouldRememberActiveJob(activeJob, session, snapshot.dataUpdatedAt)) {
      try {
        rememberSummaryJob(ownerId, materialId, activeJob, session);
      } catch (error) {
        setRestoreError(toApiError(error).message);
      }
    }
  }, [ownerId, materialId, snapshot.data, snapshot.dataUpdatedAt, session, restoreError, refreshing]);

  const jobId = session?.jobId ?? '';
  useEffect(() => {
    if (focused && appActive) setMonitoringStartedAt(Date.now());
  }, [focused, appActive, jobId]);

  const job = useQuery({
    queryKey: summaryKeys.job(ownerId, jobId),
    queryFn: ({ signal }) => getSummaryJob(ownerId, jobId, materialId, signal),
    enabled: Boolean(ownerId && jobId && focused && appActive && !restoreError && !snapshot.data?.summary),
    staleTime: 0,
    retry: retryRead,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchInterval: (query) => getJobPollInterval(
      query.state.data,
      query.state.status === 'error',
      monitoringStartedAt,
      session?.pollAfterMs,
    ),
    refetchIntervalInBackground: false,
  });

  const summary = snapshot.data?.summary ?? (job.data?.status === 'COMPLETED' ? job.data.result ?? null : null);
  useEffect(() => {
    if (job.data?.status !== 'COMPLETED' || !job.data.result) return;
    queryClient.setQueryData<SummarySnapshot>(summaryKeys.snapshot(ownerId, materialId), {
      summary: job.data.result,
      activeJob: null,
    });
    clearCompletedSession(ownerId, materialId);
  }, [job.data, ownerId, materialId, queryClient]);

  const mutation = useMutation({
    mutationKey: ['start-summary', ownerId, materialId],
    mutationFn: (retryFailed: boolean) => startSummary(ownerId, materialId, retryFailed),
    retry: false,
    onSuccess: (result) => {
      setMonitoringStartedAt(Date.now());
      queryClient.setQueryData<SummarySnapshot>(summaryKeys.snapshot(ownerId, materialId), result.kind === 'summary'
        ? { summary: result.summary, activeJob: null }
        : { summary: null, activeJob: result.job });
    },
  });

  const generate = async (retryFailed = false) => {
    if (summary || actionInProgress.current || restoreError || session === undefined) return;
    actionInProgress.current = true;
    mutation.reset();
    try {
      await mutation.mutateAsync(retryFailed);
    } catch {
      // Mutation state supplies the UI error; the persisted request key is retained.
    } finally {
      actionInProgress.current = false;
    }
  };

  const refreshStatus = async () => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setRefreshing(true);
    setMonitoringStartedAt(Date.now());
    mutation.reset();
    try {
      const latest = await snapshot.refetch();
      if (!latest.data?.summary && jobId) await job.refetch();
    } finally {
      actionInProgress.current = false;
      setRefreshing(false);
    }
  };

  return {
    summary,
    snapshot,
    job,
    session,
    mutation,
    restoreError,
    restoreSession,
    generate,
    refreshStatus,
    refreshing,
    monitoringPaused: Boolean(jobId && !isTerminalJob(job.data?.status) &&
      Date.now() - monitoringStartedAt >= MAX_JOB_MONITOR_MS),
  };
}
