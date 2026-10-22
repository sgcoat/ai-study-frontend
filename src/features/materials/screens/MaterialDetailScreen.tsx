import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useEffect, useRef, useState } from 'react';
import { usePreventRemove } from '@react-navigation/native';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { toApiError } from '../../../api/apiError';
import { AppScreen } from '../../../components/AppScreen';
import { ErrorState, LoadingState } from '../../../components/ResourceState';
import { PrimaryButton } from '../../../components/PrimaryButton';
import type { MaterialsStackParamList } from '../../../navigation/types';
import { SummaryPanel } from '../../summaries/components/SummaryPanel';
import { QuestionsPanel } from '../../questions/components/QuestionsPanel';
import { MaterialImageGrid } from '../components/MaterialImageGrid';
import { useMaterialQuery } from '../hooks/useMaterials';
import { useMaterialManagement } from '../hooks/useMaterialManagement';
import { useAuthStore } from '../../auth/store/authStore';
import { cleanupMaterialLearningData, hasPendingMaterialCleanup } from '../services/materialCleanup';
import { resolveMaterialImageUri } from '../utils/imageUri';

type Props = NativeStackScreenProps<MaterialsStackParamList, 'MaterialDetail'>;

export function MaterialDetailScreen({ route, navigation }: Props) {
  const query = useMaterialQuery(route.params.materialId);
  const { remove } = useMaterialManagement(route.params.materialId);
  const owner = useAuthStore((state) => state.user?.id) ?? '';
  const removing = useRef(false);
  const confirming = useRef(false);
  const leaveAllowed = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  usePreventRemove(remove.isPending, ({ data }) => {
    if (leaveAllowed.current) navigation.dispatch(data.action);
    else Alert.alert('삭제 중이에요', '삭제 결과를 확인한 뒤 이동해 주세요.');
  });
  if (query.isPending) {
    return <AppScreen edges={[]}><LoadingState /></AppScreen>;
  }
  if (!query.data) {
    const error = toApiError(query.error);
    const missing = error.kind === 'not_found';
    return (
      <AppScreen edges={[]}>
        <ErrorState
          title={missing ? '자료를 찾을 수 없어요' : '자료를 불러오지 못했어요'}
          description={error.message}
          actionLabel={missing ? '목록으로 돌아가기' : '다시 시도'}
          onAction={missing ? () => navigation.popToTop() : () => void query.refetch()}
        />
      </AppScreen>
    );
  }

  const material = query.data;
  const pendingCleanup = Boolean(route.params.cleanupPending || (owner && hasPendingMaterialCleanup(owner, material.id)));
  const deleteConfirmed = async () => {
    if (removing.current || !material.revision) return;
    removing.current = true; setDeleteError(null);
    try {
      const result = await remove.mutateAsync(material.revision);
      if (!mounted.current) return;
      leaveAllowed.current = true;
      navigation.popTo('MaterialsList', { notice: result.cleanupWarning ?? '자료를 삭제했어요.' });
    } catch (error) { if (mounted.current) setDeleteError(toApiError(error).message); }
    finally { removing.current = false; }
  };
  const confirmDelete = () => {
    if (removing.current || confirming.current) return;
    if (!material.revision) { setDeleteError('서버를 재시작한 뒤 자료를 새로 불러와 주세요.'); return; }
    confirming.current = true;
    Alert.alert('자료를 삭제할까요?', `「${material.title}」와 첨부 이미지, 요약·문제·풀이 기록이 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.`, [
      { text: '취소', style: 'cancel', onPress: () => { confirming.current = false; } },
      { text: '자료 삭제', style: 'destructive', onPress: () => { confirming.current = false; void deleteConfirmed(); } },
    ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  };
  return (
    <AppScreen edges={[]} scrollable>
      <View style={styles.content}>
        {route.params.notice ? <View style={styles.notice}>
          <Text accessibilityLiveRegion="polite" style={styles.noticeText}>{route.params.notice}</Text>
          <Pressable accessibilityRole="button" onPress={() => navigation.setParams({ notice: undefined })}><Text style={styles.dismiss}>닫기</Text></Pressable>
        </View> : null}
        <View style={styles.meta}>
          <View style={styles.subjectBadge}><Text style={styles.subject}>{material.subject}</Text></View>
          <Text style={styles.visibility}>{material.isPublic ? '공개 자료' : '비공개 자료'}</Text>
        </View>
        <Text style={styles.title}>{material.title}</Text>
        <View style={styles.actions}>
          <View style={styles.action}><PrimaryButton title="자료 수정" variant="secondary" disabled={remove.isPending} onPress={() => navigation.navigate('MaterialEdit', { materialId: material.id })} /></View>
          <View style={styles.action}><PrimaryButton title="자료 삭제" variant="danger" loading={remove.isPending} onPress={confirmDelete} /></View>
        </View>
        {deleteError ? <View style={styles.notice}>
          <Text accessibilityRole="alert" style={styles.error}>{deleteError}</Text>
          <PrimaryButton title="자료 상태 다시 확인" variant="secondary" onPress={() => void query.refetch()} disabled={remove.isPending} />
        </View> : null}
        {query.isError ? <Text style={styles.error}>{toApiError(query.error).message}</Text> : null}
        {pendingCleanup ? <ErrorState title="기기의 이전 학습 정보를 정리해 주세요"
          description="자료 변경은 완료되었어요. 기기에 남은 이전 학습 정보를 정리한 뒤 다시 복습할 수 있어요."
          actionLabel="기기 정보 다시 정리" onAction={() => {
            const warning = cleanupMaterialLearningData(owner, material.id);
            navigation.setParams({ cleanupPending: Boolean(warning), notice: warning ?? '기기의 이전 학습 정보를 정리했어요.' });
          }} /> : <>
          <SummaryPanel key={`summary-${material.id}-${material.revision ?? 1}`} materialId={material.id} />
          <QuestionsPanel key={`questions-${material.id}-${material.revision ?? 1}`} materialId={material.id} navigation={navigation} />
        </>}
        {material.content.trim() ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>원본 필기</Text>
            <View style={styles.textCard}>
              <Text selectable style={styles.body}>{material.content}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.imageOnly}>이미지로 등록한 필기입니다. 사진을 눌러 내용을 확인해 보세요.</Text>
        )}
        {material.imagePaths.length ? (
          <View style={styles.section}>
            <View style={styles.meta}>
              <Text style={styles.sectionTitle}>필기 이미지</Text>
              <Text style={styles.visibility}>{material.imagePaths.length}장 · 눌러서 크게 보기</Text>
            </View>
            <MaterialImageGrid onRefresh={() => void query.refetch()} images={material.imagePaths.map((path, index) => ({
              id: `${material.id}-${index}`,
              uri: resolveMaterialImageUri(path),
            }))} />
          </View>
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 24 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  subjectBadge: { backgroundColor: '#ECEEFF', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  subject: { color: '#4F53D4', fontSize: 13, fontWeight: '700' },
  visibility: { color: '#8992A2', fontSize: 12 },
  title: { color: '#172033', fontSize: 27, fontWeight: '800', lineHeight: 36 },
  section: { gap: 14 },
  sectionTitle: { color: '#343D50', fontSize: 16, fontWeight: '700' },
  textCard: { padding: 20, backgroundColor: '#FFFFFF', borderRadius: 18 },
  body: { color: '#4A556B', fontSize: 15, lineHeight: 26 },
  imageOnly: { color: '#758094', fontSize: 14, lineHeight: 22 },
  error: { color: '#C33F4D', fontSize: 13, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 12 }, action: { flex: 1 },
  notice: { backgroundColor: '#ECEEFF', padding: 16, borderRadius: 14, gap: 12 },
  noticeText: { color: '#4F53D4', fontSize: 13, lineHeight: 21 }, dismiss: { color: '#5B5FEF', fontSize: 13, fontWeight: '700' },
});
