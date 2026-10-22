import { useEffect, useRef, useState } from 'react';
import { usePreventRemove } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { ApiError, toApiError } from '../../../api/apiError';
import { AppScreen } from '../../../components/AppScreen';
import { FormField } from '../../../components/FormField';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { ErrorState, LoadingState } from '../../../components/ResourceState';
import type { MaterialsStackParamList } from '../../../navigation/types';
import type { LearningMaterial } from '../../../types';
import { useAuthStore } from '../../auth/store/authStore';
import { MaterialImageGrid } from '../components/MaterialImageGrid';
import { clearMaterialRelatedQueries, useMaterialManagement } from '../hooks/useMaterialManagement';
import { useMaterialQuery } from '../hooks/useMaterials';
import { captureMaterialImage, MAX_MATERIAL_IMAGES, selectMaterialImages } from '../services/imagePreparation';
import { cleanupMaterialLearningData } from '../services/materialCleanup';
import type { LocalMaterialImage, UpdateMaterialInput } from '../types';
import { resolveMaterialImageUri } from '../utils/imageUri';

type Props = NativeStackScreenProps<MaterialsStackParamList, 'MaterialEdit'>;

export function MaterialEditScreen({ route, navigation }: Props) {
  const query = useMaterialQuery(route.params.materialId);
  const [snapshot, setSnapshot] = useState<LearningMaterial | null>(null);
  const [formVersion, setFormVersion] = useState(0);
  const client = useQueryClient();
  useEffect(() => { if (!snapshot && query.data) setSnapshot(query.data); }, [snapshot, query.data]);
  if (!snapshot) {
    return <AppScreen edges={[]}>{query.isPending ? <LoadingState /> : <ErrorState
      title="자료를 불러오지 못했어요" description={toApiError(query.error).message} onAction={() => void query.refetch()} />}</AppScreen>;
  }
  if (!snapshot.revision || !snapshot.imageIds) {
    return <AppScreen edges={[]}><ErrorState title="자료를 새로 불러와 주세요"
      description="수정에 필요한 정보를 확인하지 못했어요. 다시 불러온 뒤 수정할 수 있어요."
      onAction={() => { void query.refetch().then((result) => { if (result.data) setSnapshot(result.data); }); }} /></AppScreen>;
  }
  return <MaterialEditor key={`${snapshot.id}-${snapshot.revision}-${formVersion}`} material={snapshot} latest={query.data ?? snapshot}
    navigation={navigation} refreshImages={() => void query.refetch()} onReload={async () => {
      const result = await query.refetch();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('자료를 불러오지 못했습니다.');
      const fresh = result.data;
      const changed = fresh.title !== snapshot.title || fresh.subject !== snapshot.subject || fresh.content !== snapshot.content ||
        JSON.stringify(fresh.imageIds) !== JSON.stringify(snapshot.imageIds);
      const warning = changed ? cleanupMaterialLearningData(snapshot.authorId, snapshot.id) : null;
      if (warning) throw new ApiError(warning, 'unknown');
      if (changed) await clearMaterialRelatedQueries(client, snapshot.authorId, snapshot.id);
      setSnapshot(fresh);
      setFormVersion((value) => value + 1);
    }} />;
}

function MaterialEditor({ material, latest, navigation, onReload, refreshImages }: {
  material: LearningMaterial; latest: LearningMaterial; navigation: Props['navigation'];
  onReload: () => Promise<void>; refreshImages: () => void;
}) {
  const owner = useAuthStore((state) => state.user?.id) ?? '';
  const { update } = useMaterialManagement(material.id);
  const [title, setTitle] = useState(material.title);
  const [subject, setSubject] = useState(material.subject);
  const [content, setContent] = useState(material.content);
  const [isPublic, setIsPublic] = useState(material.isPublic);
  const [retained, setRetained] = useState(material.imageIds ?? []);
  const [images, setImages] = useState<LocalMaterialImage[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<ApiError | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [reloading, setReloading] = useState(false);
  const operation = useRef(false);
  const confirming = useRef(false);
  const leaveAllowed = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const dirty = title !== material.title || subject !== material.subject || content !== material.content || isPublic !== material.isPublic ||
    retained.length !== material.imagePaths.length || images.length > 0;
  const busy = preparing || update.isPending || reloading;
  const imageCount = retained.length + images.length;

  usePreventRemove(dirty || busy, ({ data }) => {
    if (leaveAllowed.current) { navigation.dispatch(data.action); return; }
    if (operation.current) { Alert.alert('처리 중이에요', '이미지 준비 또는 저장이 끝난 뒤 이동해 주세요.'); return; }
    Alert.alert('수정을 그만둘까요?', '저장하지 않은 변경 내용은 사라집니다.', [
      { text: '계속 수정', style: 'cancel' },
      { text: '나가기', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  const addImages = async (source: 'camera' | 'gallery') => {
    if (operation.current || confirming.current || imageCount >= MAX_MATERIAL_IMAGES) return;
    operation.current = true; setPreparing(true); setImageError(null);
    try {
      const selected = source === 'camera' ? await captureMaterialImage(owner) : await selectMaterialImages(MAX_MATERIAL_IMAGES - imageCount, owner);
      if (mounted.current) setImages((current) => [...current, ...selected]);
    } catch (error) {
      if (mounted.current) setImageError(error instanceof Error ? error.message : '이미지를 준비하지 못했습니다.');
    } finally { operation.current = false; if (mounted.current) setPreparing(false); }
  };

  const persist = async (input: UpdateMaterialInput) => {
    if (operation.current) return;
    operation.current = true; setSaveError(null);
    try {
      const result = await update.mutateAsync(input);
      if (!mounted.current) return;
      leaveAllowed.current = true;
      navigation.popTo('MaterialDetail', { materialId: material.id,
        notice: result.cleanupWarning ?? '자료를 수정했어요.', cleanupPending: Boolean(result.cleanupWarning) });
    } catch (error) { if (mounted.current) setSaveError(toApiError(error)); }
    finally { operation.current = false; }
  };

  const save = () => {
    if (operation.current || confirming.current) return;
    setSubmitted(true); setSaveError(null);
    if (!title.trim() || !subject.trim() || (!content.trim() && !imageCount)) return;
    const learningChanged = title.trim() !== material.title || subject.trim() !== material.subject || content !== material.content ||
      retained.length !== material.imagePaths.length || images.length > 0;
    const input: UpdateMaterialInput = { title: title.trim(), subject: subject.trim(), content, isPublic, images,
      expectedRevision: material.revision!, retainedImageIds: retained, resetStudyData: learningChanged };
    if (!learningChanged) { void persist(input); return; }
    confirming.current = true;
    Alert.alert('학습 내용을 수정할까요?', '이 자료의 기존 요약·문제·풀이 기록이 초기화됩니다. 다른 자료의 기록은 유지됩니다.', [
      { text: '계속 수정', style: 'cancel', onPress: () => { confirming.current = false; } },
      { text: '초기화하고 저장', style: 'destructive', onPress: () => { confirming.current = false; void persist(input); } },
    ], { cancelable: true, onDismiss: () => { confirming.current = false; } });
  };

  const reload = () => Alert.alert('최신 자료를 불러올까요?', '현재 입력한 변경 내용은 최신 자료로 바뀝니다.', [
    { text: '계속 수정', style: 'cancel' },
    { text: '불러오기', onPress: () => {
      if (operation.current) return;
      operation.current = true; setReloading(true);
      void onReload().catch((error: unknown) => { if (mounted.current) setSaveError(toApiError(error)); })
        .finally(() => { operation.current = false; if (mounted.current) setReloading(false); });
    } },
  ]);

  const savedImages = retained.map((id) => {
    const currentIndex = latest.imageIds?.indexOf(id) ?? -1;
    const index = material.imageIds!.indexOf(id);
    return { id, uri: resolveMaterialImageUri(currentIndex >= 0 ? latest.imagePaths[currentIndex] : material.imagePaths[index]) };
  });
  return <AppScreen edges={[]} scrollable><View style={styles.page}>
    <Text style={styles.heading}>자료 수정</Text>
    <Text style={styles.hint}>제목·과목·필기·이미지를 수정하면 기존 학습 결과가 초기화돼요. 공개 여부만 바꾸면 학습 결과를 유지해요.</Text>
    {latest.revision !== material.revision ? <View style={styles.card}>
      <Text style={styles.error}>서버의 자료가 변경되었어요. 최신 자료를 확인해 주세요.</Text>
      <PrimaryButton title="최신 자료 불러오기" variant="secondary" onPress={reload} disabled={busy} />
    </View> : null}
    <FormField label="제목" value={title} onChangeText={setTitle} editable={!busy} maxLength={100}
      error={submitted && !title.trim() ? '제목을 입력해 주세요.' : null} />
    <FormField label="과목" value={subject} onChangeText={setSubject} editable={!busy} maxLength={50}
      error={submitted && !subject.trim() ? '과목을 입력해 주세요.' : null} />
    <FormField label="필기 내용" value={content} onChangeText={setContent} editable={!busy} multiline maxLength={30000}
      textAlignVertical="top" style={styles.input} error={submitted && !content.trim() && !imageCount ? '필기 내용이나 이미지를 등록해 주세요.' : null} />
    <View style={styles.card}>
      <Text style={styles.label}>필기 이미지 · {imageCount}/{MAX_MATERIAL_IMAGES}장</Text>
      <Text style={styles.hint}>기존 이미지를 지우거나 새 이미지를 추가할 수 있어요. 새 이미지는 압축한 뒤 전송해요.</Text>
      <View style={styles.row}>
        <View style={styles.grow}><PrimaryButton title="갤러리 선택" variant="secondary" disabled={busy || imageCount >= MAX_MATERIAL_IMAGES} onPress={() => void addImages('gallery')} /></View>
        <View style={styles.grow}><PrimaryButton title="사진 촬영" variant="secondary" disabled={busy || imageCount >= MAX_MATERIAL_IMAGES} onPress={() => void addImages('camera')} /></View>
      </View>
      {preparing ? <Text style={styles.hint}>이미지를 준비하고 있어요…</Text> : null}
      {imageError ? <Text accessibilityRole="alert" style={styles.error}>{imageError}</Text> : null}
      <MaterialImageGrid images={[...savedImages, ...images]} disabled={busy} onRefresh={refreshImages} onRemove={(id) => {
        setRetained((current) => current.filter((imageId) => imageId !== id));
        setImages((current) => current.filter((image) => image.id !== id));
      }} />
    </View>
    <View style={[styles.card, styles.row]}>
      <View style={styles.grow}><Text style={styles.label}>공개 여부</Text><Text style={styles.hint}>{isPublic ? '공개 자료로 저장합니다.' : '나만 볼 수 있는 자료로 저장합니다.'}</Text></View>
      <Switch accessibilityLabel="자료 공개 여부" value={isPublic} onValueChange={setIsPublic} disabled={busy} />
    </View>
    {saveError ? <View style={styles.card}>
      <Text accessibilityRole="alert" style={styles.error}>{saveError.message}</Text>
      {saveError.code === 'MATERIAL_CONFLICT' || saveError.kind === 'network' ? <PrimaryButton title="최신 자료 확인" variant="secondary" onPress={reload} disabled={busy} /> : null}
    </View> : null}
    <PrimaryButton title="변경 내용 저장" onPress={save} loading={update.isPending} disabled={!dirty || preparing || reloading} />
  </View></AppScreen>;
}

const styles = StyleSheet.create({
  page: { gap: 20 }, heading: { color: '#172033', fontSize: 24, fontWeight: '800' },
  hint: { color: '#758094', fontSize: 13, lineHeight: 21 }, label: { color: '#343D50', fontSize: 14, fontWeight: '700' },
  card: { padding: 18, borderRadius: 16, backgroundColor: '#FFFFFF', gap: 12 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'center' }, grow: { flex: 1 },
  input: { minHeight: 190, paddingVertical: 16, lineHeight: 24 }, error: { color: '#B53247', fontSize: 13, lineHeight: 21 },
});
