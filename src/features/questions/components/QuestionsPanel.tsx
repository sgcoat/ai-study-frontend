import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Text, View } from 'react-native';

import { toApiError } from '../../../api/apiError';
import { PrimaryButton } from '../../../components/PrimaryButton';
import type { MaterialsStackParamList } from '../../../navigation/types';
import { useQuestionSets } from '../hooks/useQuestions';
import { useQuizLauncher } from '../hooks/useQuizLauncher';
import { QuestionMessage, QuestionSetInfo, questionStyles as styles } from './QuestionUI';

export function QuestionsPanel({ materialId, navigation }: {
  materialId: string; navigation: NativeStackNavigationProp<MaterialsStackParamList>;
}) {
  const query = useQuestionSets(materialId);
  const launcher = useQuizLauncher(navigation);
  return <View style={{ gap: 14 }}>
    <Text style={styles.heading}>복습 문제</Text>
    <PrimaryButton title="문제 유형·개수 선택" variant="secondary" onPress={() => navigation.navigate('QuestionGenerate', { materialId })} />
    <Text style={styles.caption}>저장된 요약을 바탕으로 문제를 생성합니다. 이미 만든 문제는 언제든 다시 풀 수 있어요.</Text>
    {query.isPending ? <QuestionMessage title="저장된 문제를 확인하고 있어요" pending /> : null}
    {query.isError ? <QuestionMessage title="문제를 불러오지 못했어요" description={toApiError(query.error).message}
      action="다시 확인" onAction={() => void query.refetch()} pending={query.isFetching} /> : null}
    {query.data?.activeJobs.length ? <Text style={styles.badge}>생성 중인 문제가 있어요. 유형·개수 선택 화면에서 이어 확인하세요.</Text> : null}
    {query.data && !query.data.sets.length && !query.data.activeJobs.length ? <Text style={styles.caption}>아직 생성한 문제가 없습니다.</Text> : null}
    {launcher.error ? <Text style={styles.error}>{launcher.error}</Text> : null}
    {query.data?.sets.map((set) => <View key={set.id} style={styles.card}>
      <QuestionSetInfo set={set} />
      <PrimaryButton title="풀기 · 이어 풀기 · 결과 확인" onPress={() => launcher.open(set)} disabled={launcher.loading} />
    </View>)}
  </View>;
}
