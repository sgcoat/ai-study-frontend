import { useEffect, useRef, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { usePreventRemove } from '@react-navigation/native';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';

import { toApiError } from '../../../api/apiError';
import { useAuthStore } from '../../auth/store/authStore';
import { AppScreen } from '../../../components/AppScreen';
import { FormField } from '../../../components/FormField';
import { PrimaryButton } from '../../../components/PrimaryButton';
import { ErrorState, LoadingState } from '../../../components/ResourceState';
import type { MaterialsStackParamList } from '../../../navigation/types';
import { MaterialImageGrid } from '../components/MaterialImageGrid';
import { useCreateMaterialMutation } from '../hooks/useMaterials';
import { useMaterialDraft } from '../hooks/useMaterialDraft';
import { getMaterialRegistration } from '../api/materialsApi';
import { captureMaterialImage, MAX_MATERIAL_IMAGES, selectMaterialImages } from '../services/imagePreparation';

type Props = NativeStackScreenProps<MaterialsStackParamList, 'MaterialCreate'>;

export function MaterialCreateScreen({ navigation }: Props) {
  const ownerId = useAuthStore((state) => state.user?.id);
  const draftState = useMaterialDraft(ownerId ?? '');
  const { title, subject, content, images, isPublic } = draftState.values;
  const [submitted, setSubmitted] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [checking, setChecking] = useState(false);
  const imageActionInProgress = useRef(false);
  const saveInProgress = useRef(false);
  const mounted = useRef(true);
  const leaveAllowed = useRef(false);
  const mutation = useCreateMaterialMutation();
  const busy = preparing || mutation.isPending || checking;
  const locked = Boolean(draftState.draft && draftState.draft.submission !== 'editing');
  const titleError = submitted && !title.trim() ? '제목을 입력해 주세요.' : null;
  const subjectError = submitted && !subject.trim() ? '과목을 입력해 주세요.' : null;
  const contentError = submitted && !content.trim() && !images.length
    ? '필기 내용이나 이미지를 하나 이상 등록해 주세요.'
    : null;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  usePreventRemove(draftState.dirty || busy, ({ data }) => {
    if (leaveAllowed.current) { navigation.dispatch(data.action); return; }
    if (imageActionInProgress.current || saveInProgress.current) {
      Alert.alert('처리 중이에요', '이미지 준비 또는 자료 등록이 끝난 뒤 이동해 주세요.'); return;
    }
    try { draftState.flush(); navigation.dispatch(data.action); }
    catch {
      Alert.alert('아직 임시 저장하지 못했어요', '기기 저장 공간을 확인해 주세요. 나가면 마지막 저장 이후 입력한 내용이 사라질 수 있어요.', [
        { text: '계속 작성', style: 'cancel' },
        { text: '다시 저장', onPress: () => { try { draftState.flush(); navigation.dispatch(data.action); } catch { /* Show the draft storage error. */ } } },
        { text: '나가기', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
      ]);
    }
  });

  const discard = () => {
    if (imageActionInProgress.current || saveInProgress.current) return;
    Alert.alert('임시 저장본을 삭제할까요?', locked
      ? '작성 내용과 임시 저장한 사진을 지웁니다. 이미 등록된 자료가 있다면 자료 목록에 남아 있어요.'
      : '작성 내용과 임시 저장한 사진을 지우고 새로 작성합니다.', [
      { text: '취소', style: 'cancel' },
      { text: '임시 저장 삭제', style: 'destructive', onPress: () => {
        if (useAuthStore.getState().user?.id !== ownerId) return;
        try { draftState.discard(); setSubmitted(false); setSaveError(null); setImageError(null); }
        catch (error) { setSaveError(error instanceof Error ? error.message : '임시 저장본을 삭제하지 못했어요.'); }
      } },
    ]);
  };

  const addImages = async (source: 'camera' | 'gallery') => {
    if (imageActionInProgress.current || saveInProgress.current || locked) return;
    const remaining = MAX_MATERIAL_IMAGES - images.length;
    if (remaining <= 0) {
      setImageError(`이미지는 최대 ${MAX_MATERIAL_IMAGES}장까지 첨부할 수 있습니다.`);
      return;
    }

    imageActionInProgress.current = true;
    setPreparing(true);
    setImageError(null);
    try {
      if (!ownerId) throw new Error('로그인이 필요합니다.');
      const selected = source === 'camera'
        ? await captureMaterialImage(ownerId)
        : await selectMaterialImages(remaining, ownerId);
      if (mounted.current && useAuthStore.getState().user?.id === ownerId && selected.length) draftState.attachImages(selected);
    } catch (error) {
      if (mounted.current) {
        setImageError(error instanceof Error ? error.message : '이미지를 준비하지 못했습니다. 다시 시도해 주세요.');
      }
    } finally {
      imageActionInProgress.current = false;
      if (mounted.current) setPreparing(false);
    }
  };

  const saveMaterial = async (submitIfMissing = true) => {
    if (saveInProgress.current || imageActionInProgress.current) return;
    setSubmitted(true);
    setSaveError(null);
    if (!locked && (!title.trim() || !subject.trim() || (!content.trim() && !images.length))) return;

    saveInProgress.current = true;
    setChecking(true);
    let postStarted = false;
    try {
      if (!ownerId) throw new Error('로그인이 필요합니다.');
      const draft = locked ? draftState.flush() : draftState.beginSubmission();
      const existing = await getMaterialRegistration(ownerId, draft.id);
      const open = (id: string) => {
        const warning = draftState.finishSubmission(id);
        if (mounted.current && useAuthStore.getState().user?.id === ownerId) {
          leaveAllowed.current = true;
          navigation.replace('MaterialDetail', { materialId: id, notice: warning ?? '자료를 등록했어요.' });
        }
      };
      if (existing) { open(existing.id); return; }
      if (!submitIfMissing || draft.submission === 'submitted') {
        if (mounted.current) setSaveError('아직 등록 결과를 확인하지 못했어요. 자료 목록을 확인하거나 같은 내용으로 등록을 다시 시도해 주세요.'); return;
      }
      if (draftState.missingImages.length) throw new Error('등록에 필요한 사진을 불러오지 못했어요. 등록 결과나 임시 저장본을 확인해 주세요.');
      postStarted = true;
      const material = await mutation.mutateAsync({
        title: draft.title, subject: draft.subject, content: draft.content, images: draft.images,
        isPublic: draft.isPublic, requestKey: draft.id,
      });
      open(material.id);
    } catch (error) {
      const failure = toApiError(error);
      // An initial lookup failure sent no POST; a rejected initial validation also created nothing.
      if (!locked && (!postStarted || [400, 415, 422, 429].includes(failure.status ?? 0))) draftState.allowEditingAfterRejection();
      if (mounted.current) setSaveError(failure.message);
    } finally {
      saveInProgress.current = false;
      if (mounted.current) setChecking(false);
    }
  };

  if (draftState.restoring) return <AppScreen edges={[]}><LoadingState label="임시 저장본을 확인하고 있어요" /></AppScreen>;
  if (draftState.restoreError || !draftState.draft) return <AppScreen edges={[]}><View style={styles.content}>
    <ErrorState title="임시 저장본을 불러오지 못했어요" description={draftState.restoreError ?? '다시 확인해 주세요.'} onAction={draftState.reload} />
    {saveError ? <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text> : null}
    <PrimaryButton title="임시 저장본 삭제 후 새로 작성" variant="danger" onPress={discard} />
  </View></AppScreen>;

  return (
    <AppScreen edges={[]} scrollable>
      <View style={styles.content}>
        <Text style={styles.heading}>복습할 내용을 모아 보세요</Text>
        <Text style={styles.description}>텍스트와 필기 이미지를 함께 등록할 수 있어요.</Text>
        <View style={styles.draftCard}>
          <Text style={styles.sectionTitle}>{locked ? '등록 결과를 확인해 주세요' : draftState.storageError ? '임시 저장을 확인해 주세요' : draftState.dirty ? '임시 저장 중이에요…' : '이 기기에 임시 저장했어요'}</Text>
          <Text style={styles.hint}>{locked ? '입력 내용을 보관했어요. 등록 결과를 확인하거나 같은 요청으로 다시 시도할 수 있어요.'
            : `${new Date(draftState.draft.updatedAt).toLocaleString('ko-KR')} · 나갔다가 다시 이어 쓸 수 있어요.`}</Text>
          {draftState.storageError ? <Text accessibilityRole="alert" style={styles.error}>{draftState.storageError}</Text> : null}
          {draftState.storageError ? <PrimaryButton title="저장본 다시 불러오기" variant="secondary" disabled={busy} onPress={() => {
            Alert.alert('저장본을 다시 불러올까요?', '마지막 저장 이후 입력한 내용은 저장된 내용으로 바뀝니다.', [
              { text: '계속 작성', style: 'cancel' }, { text: '불러오기', onPress: draftState.reload },
            ]);
          }} /> : null}
          <View style={styles.imageActions}>
            {!locked ? <View style={styles.imageAction}><PrimaryButton title="임시 저장" variant="secondary" disabled={busy} onPress={() => { try { draftState.flush(); } catch { /* Draft state displays the error. */ } }} /></View> : null}
            <View style={styles.imageAction}><PrimaryButton title="임시 저장 삭제" variant="secondary" disabled={busy} onPress={discard} /></View>
          </View>
          {locked ? <>
            <PrimaryButton title="등록 결과 확인" variant="secondary" loading={checking} disabled={busy} onPress={() => void saveMaterial(false)} />
            {draftState.draft.submission === 'pending' ? <PrimaryButton title="같은 내용으로 등록 다시 시도" loading={mutation.isPending} disabled={busy} onPress={() => void saveMaterial(true)} /> : null}
          </> : null}
        </View>
        <FormField
          label="제목"
          placeholder="예: 세포 호흡과 ATP"
          value={title}
          onChangeText={(value) => draftState.change({ title: value })}
          error={titleError}
          editable={!busy && !locked}
          maxLength={100}
        />
        <FormField
          label="과목"
          placeholder="예: 생명과학"
          value={subject}
          onChangeText={(value) => draftState.change({ subject: value })}
          error={subjectError}
          editable={!busy && !locked}
          maxLength={50}
        />
        <FormField
          label="필기 내용"
          placeholder="수업 필기를 붙여 넣거나 직접 입력하세요."
          value={content}
          onChangeText={(value) => draftState.change({ content: value })}
          error={contentError}
          editable={!busy && !locked}
          multiline
          textAlignVertical="top"
          maxLength={30000}
          style={styles.contentInput}
        />
        <View style={styles.imageSection}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>필기 이미지</Text>
            <Text style={styles.imageCount}>{images.length}/{MAX_MATERIAL_IMAGES}장</Text>
          </View>
          <Text style={styles.hint}>갤러리에서 여러 장을 선택하거나 새로 촬영할 수 있어요.</Text>
          <View style={styles.imageActions}>
            <View style={styles.imageAction}>
              <PrimaryButton
                title="갤러리 선택"
                variant="secondary"
                disabled={busy || locked || images.length >= MAX_MATERIAL_IMAGES}
                onPress={() => void addImages('gallery')}
              />
            </View>
            <View style={styles.imageAction}>
              <PrimaryButton
                title="사진 촬영"
                variant="secondary"
                disabled={busy || locked || images.length >= MAX_MATERIAL_IMAGES}
                onPress={() => void addImages('camera')}
              />
            </View>
          </View>
          {preparing ? <Text style={styles.hint}>이미지를 준비하고 있어요…</Text> : null}
          {imageError ? <Text style={styles.error}>{imageError}</Text> : null}
          {draftState.missingImages.length ? <Text accessibilityRole="alert" style={styles.error}>사진 {draftState.missingImages.length}장을 불러오지 못했어요. 등록 전에 해당 사진을 제외하거나 다시 첨부해 주세요.</Text> : null}
          <MaterialImageGrid
            images={images}
            disabled={busy || locked}
            onRemove={(id) => {
              draftState.change({ images: images.filter((image) => image.id !== id) });
              setImageError(null);
            }}
          />
        </View>
        <View style={styles.visibilityCard}>
          <View style={styles.visibilityText}>
            <Text style={styles.sectionTitle}>공개 여부</Text>
            <Text style={styles.hint}>{isPublic ? '공개로 설정하여 저장합니다.' : '나만 볼 수 있는 자료로 저장합니다.'}</Text>
          </View>
          <Switch
            accessibilityLabel="자료 공개 여부"
            value={isPublic}
            onValueChange={(value) => draftState.change({ isPublic: value })}
            disabled={busy || locked}
            trackColor={{ false: '#DDE1E9', true: '#B9BCFF' }}
            thumbColor={isPublic ? '#5B5FEF' : '#FFFFFF'}
          />
        </View>
        {saveError ? <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text> : null}
        {!locked ? <PrimaryButton
          title={saveError ? '다시 저장' : '자료 저장'}
          loading={mutation.isPending || checking}
          disabled={preparing || draftState.missingImages.length > 0}
          onPress={() => void saveMaterial()}
        /> : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 20 },
  heading: { color: '#172033', fontSize: 22, fontWeight: '800' },
  description: { color: '#758094', fontSize: 14, lineHeight: 22, marginTop: -10 },
  contentInput: { minHeight: 190, paddingTop: 16, paddingBottom: 16, lineHeight: 24 },
  imageSection: { gap: 12 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#343D50', fontSize: 14, fontWeight: '700' },
  imageCount: { color: '#5B5FEF', fontSize: 12, fontWeight: '600' },
  hint: { color: '#8992A2', fontSize: 12, lineHeight: 19 },
  imageActions: { flexDirection: 'row', gap: 12 },
  imageAction: { flex: 1 },
  visibilityCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  visibilityText: { flex: 1, gap: 7 },
  error: { color: '#C33F4D', fontSize: 13, lineHeight: 20 },
  draftCard: { padding: 18, backgroundColor: '#ECEEFF', borderRadius: 16, gap: 12 },
});
