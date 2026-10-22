import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { toApiError } from '../../../api/apiError';
import { AppScreen } from '../../../components/AppScreen';
import { FormField } from '../../../components/FormField';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ResourceState';
import type { MaterialsStackParamList } from '../../../navigation/types';
import type { QuestionPrompt } from '../../../types';
import { AttemptFeedback, MockQuestionNotice, questionStyles as styles } from '../components/QuestionUI';
import { useQuestionSets } from '../hooks/useQuestions';
import { useQuizSession } from '../hooks/useQuizSession';
import { nextQuizQuestion, saveQuizDraft, submitQuizAnswer } from '../services/quizSession';
import { QUESTION_TYPE_LABELS } from '../types';

type Props = NativeStackScreenProps<MaterialsStackParamList, 'QuizSolve'>;

export function QuizSolveScreen({ route, navigation }: Props) {
  const { materialId, setId, sessionId } = route.params;
  const query = useQuestionSets(materialId);
  const set = query.data?.sets.find((item) => item.id === setId);
  const local = useQuizSession(set, sessionId);
  const [error, setError] = useState<string | null>(null);
  const guard = useRef(false);
  const mutation = useMutation({ mutationFn: (answer: string) => {
    if (!set) throw new Error('문제를 확인해 주세요.');
    return submitQuizAnswer(local.owner, set, sessionId, answer);
  }, retry: false });
  const question = set && local.session ? set.questions[local.session.currentIndex] : undefined;
  useEffect(() => { mutation.reset(); setError(null); }, [question?.id]);

  if (!set && query.isPending) return <AppScreen edges={[]}><LoadingState label="문제를 불러오고 있어요." /></AppScreen>;
  if (!set && query.isError) return <AppScreen edges={[]}><ErrorState title="문제를 불러오지 못했어요" description={toApiError(query.error).message} onAction={() => void query.refetch()} /></AppScreen>;
  if (!set) return <AppScreen edges={[]}><EmptyState title="저장된 문제를 찾을 수 없어요" actionLabel="자료 상세로 돌아가기"
    onAction={() => navigation.popTo('MaterialDetail', { materialId })} /></AppScreen>;
  if (local.error) return <AppScreen edges={[]}><ErrorState title="풀이를 이어갈 수 없어요" description={local.error} onAction={local.reload} /></AppScreen>;
  if (!local.session || !question) return <AppScreen edges={[]}><LoadingState label="이전 풀이를 복원하고 있어요." /></AppScreen>;

  const session = local.session;
  const attempt = session.attempts[question.id];
  const submit = async (answer: string) => {
    if (guard.current) return;
    guard.current = true; setError(null);
    try { await mutation.mutateAsync(answer); }
    catch { /* Mutation state presents the error; retry keeps the persisted submission. */ }
    finally { guard.current = false; }
  };
  const next = () => {
    if (guard.current) return;
    try {
      if (session.currentIndex === set.questions.length - 1) navigation.replace('QuizResult', { materialId, setId, sessionId });
      else nextQuizQuestion(local.owner, set, sessionId);
    } catch (failure) { setError(toApiError(failure).message); }
  };

  return <AppScreen edges={[]} scrollable><View style={styles.page}>
    <View style={styles.row}>
      <Text style={styles.badge}>{session.currentIndex + 1} / {set.questions.length}</Text>
      <Text style={styles.caption}>{QUESTION_TYPE_LABELS[question.type]}</Text>
    </View>
    <View style={styles.card}>
      <Text style={styles.heading}>{question.content}</Text>
      <AnswerEditor key={question.id} question={question}
        initial={session.pending?.submittedAnswer ?? session.drafts[question.id] ?? ''}
        locked={Boolean(attempt || session.pending || mutation.isPending)} submitting={mutation.isPending}
        retrying={Boolean(session.pending)} onSubmit={(answer) => void submit(answer)}
        onSave={(answer) => {
          try { saveQuizDraft(local.owner, set, sessionId, answer, question.id); setError(null); }
          catch (failure) { setError(toApiError(failure).message); }
        }} />
    </View>
    {session.pending && !mutation.isPending ? <Text style={styles.caption}>답안이 저장되어 있어요. 같은 답안으로 제출을 다시 확인해 주세요.</Text> : null}
    {mutation.isError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{toApiError(mutation.error).message}</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {attempt ? <>
      <AttemptFeedback question={question} result={attempt} />
      <PrimaryButton title={session.currentIndex === set.questions.length - 1 ? '최종 결과 보기' : '다음 문제'} onPress={next} />
    </> : null}
    <Text style={styles.caption}>제출한 답안은 변경할 수 없어요. 나중에 자료 상세의 저장된 문제에서 이어 풀 수 있습니다.</Text>
    <MockQuestionNotice modelInfo={set.modelInfo} />
  </View></AppScreen>;
}

function AnswerEditor({ question, initial, locked, submitting, retrying, onSave, onSubmit }: {
  question: QuestionPrompt; initial: string; locked: boolean; submitting: boolean; retrying: boolean;
  onSave: (answer: string) => void; onSubmit: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState(initial);
  const draft = useRef(initial);
  const dirty = useRef(false);
  const save = useRef(onSave);
  save.current = onSave;
  const persist = () => { if (dirty.current) { save.current(draft.current); dirty.current = false; } };
  useEffect(() => {
    const timer = setTimeout(persist, 300);
    return () => clearTimeout(timer);
  }, [answer]);
  useEffect(() => () => { if (dirty.current) save.current(draft.current); }, []);
  const update = (next: string) => { draft.current = next; dirty.current = true; setAnswer(next); };
  const choices = question.type === 'MULTIPLE_CHOICE' ? question.choices :
    question.type === 'OX' ? [{ id: 'O', content: 'O · 맞다' }, { id: 'X', content: 'X · 틀리다' }] : null;
  return <View style={{ gap: 14 }}>
    {choices ? choices.map((choice, index) => <Pressable key={choice.id} accessibilityRole="radio"
      accessibilityState={{ selected: choice.id === answer, disabled: locked }} disabled={locked}
      style={[styles.chip, choice.id === answer && styles.selected]}
      onPress={() => { update(choice.id); save.current(choice.id); dirty.current = false; }}>
      <Text style={styles.body}>{question.type === 'MULTIPLE_CHOICE' ? `${index + 1}. ` : ''}{choice.content}</Text>
    </Pressable>) : <FormField label="내 답안" multiline maxLength={5000} value={answer} editable={!locked}
      placeholder="답안을 입력해 주세요." textAlignVertical="top" style={{ minHeight: 140, paddingVertical: 14 }}
      onChangeText={update} onBlur={persist} />}
    {!locked || retrying || submitting ? <PrimaryButton title={retrying ? '같은 답안으로 제출 다시 확인' : '답안 제출'}
      disabled={!answer.trim()} loading={submitting} onPress={() => { persist(); onSubmit(answer); }} /> : null}
  </View>;
}
