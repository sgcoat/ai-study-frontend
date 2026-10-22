import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { toApiError } from '../../../api/apiError';
import { AppScreen } from '../../../components/AppScreen';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ResourceState';
import type { MaterialsStackParamList } from '../../../navigation/types';
import { QUESTION_TYPES } from '../../../types';
import { useAuthStore } from '../../auth/store/authStore';
import { getSavedSummary } from '../../summaries/api/summariesApi';
import { summaryKeys } from '../../summaries/hooks/useMaterialSummary';
import { MockQuestionNotice, QuestionMessage, QuestionSetInfo, questionStyles as styles } from '../components/QuestionUI';
import { useQuestionGeneration, useQuestionSets } from '../hooks/useQuestions';
import { useQuizLauncher } from '../hooks/useQuizLauncher';
import { useQuestionJobStore } from '../store/questionJobStore';
import { QUESTION_TYPE_LABELS, type QuestionGenerationConfig } from '../types';

type Props = NativeStackScreenProps<MaterialsStackParamList, 'QuestionGenerate'>;

export function QuestionGenerateScreen({ route, navigation }: Props) {
  const materialId = route.params.materialId;
  const owner = useAuthStore((state) => state.user?.id) ?? '';
  const summary = useQuery({ queryKey: summaryKeys.snapshot(owner, materialId),
    queryFn: ({ signal }) => getSavedSummary(owner, materialId, signal), enabled: Boolean(owner), staleTime: 0,
    retry: (count, error) => count < 1 && toApiError(error).retryable });
  const questions = useQuestionSets(materialId);
  const [initial, setInitial] = useState<QuestionGenerationConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!summary.data?.summary || !questions.data) return;
    try {
      const id = summary.data.summary.id;
      const preference = useQuestionJobStore.getState().loadPreference(owner, materialId);
      const active = questions.data.activeJobs.find((job) => job.config.summaryId === id);
      setInitial(active?.config ?? (preference?.summaryId === id ? preference : { summaryId: id, types: ['MULTIPLE_CHOICE'], count: 5 }));
      setError(null);
    } catch (failure) { setError(toApiError(failure).message); }
  }, [owner, materialId, summary.data?.summary?.id, questions.data !== undefined, revision]);

  if (summary.isPending) return <AppScreen edges={[]}><LoadingState label="저장된 요약을 확인하고 있어요." /></AppScreen>;
  if (!summary.data || (summary.isError && !summary.data.summary)) return <AppScreen edges={[]}><ErrorState title="요약을 확인하지 못했어요" description={toApiError(summary.error).message} onAction={() => void summary.refetch()} /></AppScreen>;
  if (!summary.data.summary) return <AppScreen edges={[]}><EmptyState title="먼저 요약을 생성해 주세요"
    description="자료 상세에서 요약을 저장하면 문제를 만들 수 있어요." actionLabel="자료 상세로 돌아가기"
    onAction={() => navigation.popTo('MaterialDetail', { materialId })} /></AppScreen>;
  if (error) return <AppScreen edges={[]}><ErrorState title="생성 조건을 읽지 못했어요" description={error} onAction={() => setRevision((value) => value + 1)} /></AppScreen>;
  if (questions.isError && !questions.data) return <AppScreen edges={[]}><ErrorState title="저장된 문제를 확인하지 못했어요" description={toApiError(questions.error).message} onAction={() => void questions.refetch()} /></AppScreen>;
  if (!initial) return <AppScreen edges={[]}><LoadingState label="생성 조건을 불러오고 있어요." /></AppScreen>;
  return <GenerationForm key={summary.data.summary.id} {...{ initial, materialId, owner, navigation }} />;
}

function GenerationForm({ initial, materialId, owner, navigation }: {
  initial: QuestionGenerationConfig; materialId: string; owner: string; navigation: Props['navigation'];
}) {
  const [config, setConfig] = useState(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const state = useQuestionGeneration(materialId, config);
  const launcher = useQuizLauncher(navigation);
  const { questionSet, snapshot, job, session, mutation } = state;
  const locked = session === undefined || snapshot.isPending || mutation.isPending || state.refreshing ||
    Boolean(!questionSet && session && job.data?.status !== 'FAILED') || Boolean(state.restoreError);
  const update = (next: QuestionGenerationConfig) => {
    try { useQuestionJobStore.getState().setPreference(owner, materialId, next); setConfig(next); setFormError(null); mutation.reset(); }
    catch (failure) { setFormError(toApiError(failure).message); }
  };

  let status;
  if (questionSet) status = <View style={styles.card}>
    <QuestionSetInfo set={questionSet} />
    <Text style={styles.caption}>저장된 문제를 사용할 수 있어요.</Text>
    <PrimaryButton title="문제 풀기 · 이어 풀기" onPress={() => launcher.open(questionSet)} disabled={launcher.loading} />
  </View>;
  else if (state.restoreError) status = <QuestionMessage title="생성 작업을 복원하지 못했어요" description={state.restoreError} action="다시 확인" onAction={state.restore} />;
  else if (mutation.isPending) status = <QuestionMessage title="문제 생성 요청을 확인하고 있어요" pending />;
  else if (job.data?.status === 'FAILED') status = <QuestionMessage title="문제 생성에 실패했어요"
    description={[job.data.error?.message, mutation.isError ? toApiError(mutation.error).message : null].filter(Boolean).join('\n')}
    action="문제 생성 다시 시도" onAction={() => void state.generate(true)} />;
  else if (mutation.isError) status = <QuestionMessage title="요청을 완료하지 못했어요" description={toApiError(mutation.error).message}
    action={session?.jobId ? '상태 다시 확인' : '요청 다시 확인'} pending={state.refreshing}
    onAction={session?.jobId ? () => void state.refresh() : () => void state.generate()} />;
  else if (job.isError) status = <QuestionMessage title="진행 상태를 확인하지 못했어요" description={toApiError(job.error).message}
    action="상태 다시 확인" pending={state.refreshing} onAction={() => void state.refresh()} />;
  else if (session?.jobId) status = state.monitoringPaused ?
    <QuestionMessage title="문제 생성 상태를 다시 확인해 주세요" description="작업이 계속될 수 있어요. 같은 작업의 상태를 확인합니다."
      action="상태 다시 확인" pending={state.refreshing} onAction={() => void state.refresh()} /> :
    <QuestionMessage title={job.data?.status === 'PROCESSING' ? '복습 문제를 만들고 있어요' : '문제 생성 순서를 기다리고 있어요'}
      description="자료 목록으로 돌아가도 나중에 결과를 확인할 수 있어요." pending />;
  else if (snapshot.isPending || session === undefined) status = <QuestionMessage title="저장된 문제를 확인하고 있어요" pending />;
  else if (snapshot.isError) status = <QuestionMessage title="저장된 문제를 확인하지 못했어요" description={toApiError(snapshot.error).message}
    action="다시 확인" pending={state.refreshing} onAction={() => void state.refresh()} />;
  else if (session) status = <QuestionMessage title="이전 요청을 다시 확인해 주세요" description="기존 요청을 이어 확인하면 중복 생성을 방지할 수 있어요."
    action="요청 다시 확인" onAction={() => void state.generate()} />;
  else status = <PrimaryButton title={`${config.count}문항 생성`} onPress={() => void state.generate()} />;

  const counts = [...new Set([5, 10, 15, 20, config.count])].sort((a, b) => a - b);
  return <AppScreen edges={[]} scrollable><View style={styles.page}>
    <Text style={styles.title}>나에게 맞는 복습 문제</Text>
    <Text style={styles.caption}>유형을 여러 개 선택할 수 있어요. 같은 요약·유형·개수의 문제는 저장된 결과를 재사용합니다.</Text>
    <View style={styles.card}>
      <Text style={styles.heading}>문제 유형</Text>
      <View style={styles.row}>{QUESTION_TYPES.map((type) => {
        const selected = config.types.includes(type);
        return <Pressable key={type} accessibilityRole="checkbox" accessibilityState={{ checked: selected, disabled: locked }}
          disabled={locked} style={[styles.chip, selected && styles.selected, locked && styles.disabled]}
          onPress={() => {
            if (selected && config.types.length === 1) { setFormError('문제 유형을 하나 이상 선택해 주세요.'); return; }
            update({ ...config, types: selected ? config.types.filter((item) => item !== type) : [...config.types, type] });
          }}><Text style={selected ? styles.badge : styles.body}>{QUESTION_TYPE_LABELS[type]}</Text></Pressable>;
      })}</View>
      <Text style={styles.heading}>문항 수</Text>
      <View style={styles.row}>{counts.map((count) => <Pressable key={count} accessibilityRole="radio"
        accessibilityState={{ selected: count === config.count, disabled: locked }} disabled={locked}
        style={[styles.chip, count === config.count && styles.selected, locked && styles.disabled]}
        onPress={() => update({ ...config, count })}><Text style={count === config.count ? styles.badge : styles.body}>{count}개</Text></Pressable>)}</View>
    </View>
    {formError ? <Text style={styles.error}>{formError}</Text> : null}
    {status}
    {launcher.error ? <Text style={styles.error}>{launcher.error}</Text> : null}
    <MockQuestionNotice modelInfo={questionSet?.modelInfo} />
  </View></AppScreen>;
}
