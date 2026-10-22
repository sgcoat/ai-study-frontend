import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { API_MODE } from '../../../api/transport';
import { PrimaryButton } from '../../../components/PrimaryButton';
import type { QuestionPrompt } from '../../../types';
import { answerLabel } from '../services/quizSession';
import { QUESTION_TYPE_LABELS, type QuestionAttemptResult, type QuestionSet } from '../types';

export const questionStyles = StyleSheet.create({
  page: { gap: 22 }, card: { gap: 16, padding: 20, borderRadius: 20, backgroundColor: '#FFFFFF' },
  title: { color: '#172033', fontSize: 25, fontWeight: '800', lineHeight: 34 },
  heading: { color: '#263146', fontSize: 17, fontWeight: '700', lineHeight: 25 },
  body: { color: '#4A556B', fontSize: 15, lineHeight: 25 },
  caption: { color: '#758094', fontSize: 13, lineHeight: 21 },
  error: { color: '#C33F4D', fontSize: 14, lineHeight: 22 },
  badge: { color: '#4F53D4', fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderWidth: 1, borderColor: '#E1E5ED', borderRadius: 13, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#FFFFFF' },
  selected: { borderColor: '#5B5FEF', backgroundColor: '#ECEEFF' },
  disabled: { opacity: 0.5 },
  success: { color: '#178268', fontSize: 17, fontWeight: '700' },
});

export function MockQuestionNotice({ modelInfo }: { modelInfo?: string }) {
  if (API_MODE !== 'mock' && !modelInfo?.startsWith('mock')) return null;
  return <Text style={questionStyles.caption}>개발용 예시 · 실제 AI 호출 없음{ '\n' }주관식은 모범 답안의 문자와 공백을 정리한 뒤 일치 여부로 채점합니다. 실제 의미 기반 채점은 서버의 OpenAI 모드에서 제공됩니다.</Text>;
}

export function QuestionSetInfo({ set }: { set: QuestionSet }) {
  return <View style={{ gap: 6 }}>
    <Text style={questionStyles.heading}>{set.questions.length}문항 · {set.config.types.map((type) => QUESTION_TYPE_LABELS[type]).join(' / ')}</Text>
    <Text style={questionStyles.caption}>{new Date(set.createdAt).toLocaleString('ko-KR')}</Text>
  </View>;
}

export function QuestionMessage({ title, description, action, onAction, pending = false }: {
  title: string; description?: string; action?: string; onAction?: () => void; pending?: boolean;
}) {
  return <View style={questionStyles.card}>
    {pending ? <ActivityIndicator color="#5B5FEF" /> : null}
    <Text accessibilityLiveRegion="polite" style={questionStyles.heading}>{title}</Text>
    {description ? <Text style={questionStyles.caption}>{description}</Text> : null}
    {action && onAction ? <PrimaryButton title={action} onPress={onAction} loading={pending} variant="secondary" /> : null}
  </View>;
}

export function AttemptFeedback({ question, result }: { question: QuestionPrompt; result: QuestionAttemptResult }) {
  return <View style={questionStyles.card}>
    <Text accessibilityLiveRegion="polite" style={result.record.isCorrect ? questionStyles.success : questionStyles.error}>
      {result.record.isCorrect ? '정답이에요' : '다시 복습해 보세요'}
    </Text>
    <Text style={questionStyles.caption}>내 답안</Text>
    <Text selectable style={questionStyles.body}>{answerLabel(question, result.record.submittedAnswer)}</Text>
    <Text style={questionStyles.caption}>정답 · 모범 답안</Text>
    <Text selectable style={questionStyles.body}>{answerLabel(question, result.correctAnswer)}</Text>
    <Text style={questionStyles.caption}>해설</Text>
    <Text selectable style={questionStyles.body}>{result.explanation}</Text>
  </View>;
}
