import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { toApiError } from '../../../api/apiError';
import { AppScreen } from '../../../components/AppScreen';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ResourceState';
import type { MaterialsStackParamList } from '../../../navigation/types';
import { AttemptFeedback, MockQuestionNotice, QuestionSetInfo, questionStyles as styles } from '../components/QuestionUI';
import { useQuestionSets } from '../hooks/useQuestions';
import { useQuizSession } from '../hooks/useQuizSession';
import { useQuizStore } from '../store/quizStore';

type Props = NativeStackScreenProps<MaterialsStackParamList, 'QuizResult'>;

export function QuizResultScreen({ route, navigation }: Props) {
  const { materialId, setId, sessionId } = route.params;
  const query = useQuestionSets(materialId);
  const set = query.data?.sets.find((item) => item.id === setId);
  const local = useQuizSession(set, sessionId);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  if (!set && query.isPending) return <AppScreen edges={[]}><LoadingState label="결과를 불러오고 있어요." /></AppScreen>;
  if (!set && query.isError) return <AppScreen edges={[]}><ErrorState title="결과를 불러오지 못했어요" description={toApiError(query.error).message} onAction={() => void query.refetch()} /></AppScreen>;
  if (!set) return <AppScreen edges={[]}><EmptyState title="저장된 문제를 찾을 수 없어요" actionLabel="자료 상세로 돌아가기"
    onAction={() => navigation.popTo('MaterialDetail', { materialId })} /></AppScreen>;
  if (local.error) return <AppScreen edges={[]}><ErrorState title="풀이 결과를 복원하지 못했어요" description={local.error} onAction={local.reload} /></AppScreen>;
  if (!local.session) return <AppScreen edges={[]}><LoadingState label="풀이 결과를 복원하고 있어요." /></AppScreen>;
  if (!local.session.completedAt) return <AppScreen edges={[]}><EmptyState title="아직 풀이가 끝나지 않았어요"
    actionLabel="풀이 이어가기" onAction={() => navigation.replace('QuizSolve', { materialId, setId, sessionId })} /></AppScreen>;

  const session = local.session;
  const correct = set.questions.filter((question) => session.attempts[question.id].record.isCorrect).length;
  const incorrect = set.questions.filter((question) => !session.attempts[question.id].record.isCorrect);
  const retake = () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const next = useQuizStore.getState().createSession(local.owner, set);
      navigation.replace('QuizSolve', { materialId, setId, sessionId: next.id });
    } catch (failure) { busy.current = false; setError(toApiError(failure).message); }
  };
  return <AppScreen edges={[]} scrollable><View style={styles.page}>
    <Text style={styles.title}>이번 복습 결과</Text>
    <View style={styles.card}>
      <Text style={[styles.title, { color: '#5B5FEF', fontSize: 42 }]}>{Math.round(correct / set.questions.length * 100)}%</Text>
      <Text style={styles.heading}>정답 {correct}개 · 오답 {incorrect.length}개 · 총 {set.questions.length}개</Text>
      <QuestionSetInfo set={set} />
      <Text style={styles.caption}>풀이 완료 · {new Date(session.completedAt!).toLocaleString('ko-KR')}</Text>
    </View>
    <PrimaryButton title="같은 문제 다시 풀기" onPress={retake} />
    <Text style={styles.caption}>저장된 문제를 다시 사용합니다. 새로운 풀이 기록이 만들어져요.</Text>
    <PrimaryButton title="자료·요약으로 돌아가기" variant="secondary" onPress={() => navigation.popTo('MaterialDetail', { materialId })} />
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Text style={styles.heading}>오답 복습</Text>
    {!incorrect.length ? <Text style={styles.success}>모든 문제를 맞혔어요.</Text> : null}
    {incorrect.map((question) => <View key={question.id} style={{ gap: 10 }}>
      <Text style={styles.body}>{set.questions.findIndex((item) => item.id === question.id) + 1}. {question.content}</Text>
      <AttemptFeedback question={question} result={session.attempts[question.id]} />
    </View>)}
    <MockQuestionNotice modelInfo={set.modelInfo} />
  </View></AppScreen>;
}
