import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { AppState } from 'react-native';
import { ApiError } from '../../../api/apiError';
import type { CreateMaterialInput, LocalMaterialImage, MaterialDraft } from '../types';
import { useMaterialDraftStore } from '../store/materialDraftStore';
import { createMaterialDraft, discardMaterialDraft, emptyMaterialInput, missingMaterialDraftImages,
  persistMaterialDraft, readMaterialDraft, retainMaterialDraftImages } from '../services/materialDraftStorage';

export const MATERIAL_DRAFT_SAVE_DELAY_MS = 600;
function inputOf(draft: MaterialDraft): CreateMaterialInput {
  return { title: draft.title, subject: draft.subject, content: draft.content, images: draft.images, isPublic: draft.isPublic };
}

export function useMaterialDraft(owner: string) {
  const focused = useIsFocused();
  const [draft, setDraft] = useState<MaterialDraft | null>(null);
  const [values, setValues] = useState<CreateMaterialInput>(emptyMaterialInput);
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [, recheckFiles] = useState(0);
  const persisted = useRef<MaterialDraft | null>(null);
  const currentValues = useRef<CreateMaterialInput>(emptyMaterialInput());
  const dirtyRef = useRef(false);
  const completed = useRef(false);
  const mounted = useRef(true);
  const ready = useRef(false);

  const accept = useCallback((next: MaterialDraft) => {
    persisted.current = next;
    dirtyRef.current = false;
    if (mounted.current) {
      useMaterialDraftStore.getState().publish(next.ownerId, next);
      setDraft(next); setDirty(false); setStorageError(null);
    }
  }, []);

  const reload = useCallback(() => {
    ready.current = false;
    setRestoring(true);
    try {
      const saved = readMaterialDraft(owner) ?? createMaterialDraft(owner);
      currentValues.current = inputOf(saved);
      completed.current = false;
      ready.current = true;
      accept(saved);
      setValues(currentValues.current);
      setRestoreError(null);
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : '임시 저장본을 불러오지 못했어요.');
    } finally { setRestoring(false); }
  }, [owner, accept]);

  const flush = useCallback((): MaterialDraft => {
    const saved = persisted.current;
    if (!saved || !ready.current) throw new ApiError('임시 저장본을 먼저 불러와 주세요.', 'unknown');
    if (completed.current || !dirtyRef.current) return saved;
    try {
      const next = persistMaterialDraft(saved, currentValues.current);
      accept(next);
      return next;
    } catch (error) {
      if (mounted.current) setStorageError(error instanceof Error ? error.message : '임시 저장하지 못했어요.');
      throw error;
    }
  }, [accept]);

  useEffect(() => {
    mounted.current = true;
    reload();
    return () => { mounted.current = false; try { flush(); } catch { /* Keep the last committed draft. */ } };
  }, [reload, flush]);

  useEffect(() => {
    if (restoring || restoreError || !dirty || !draft || draft.submission !== 'editing') return;
    const timer = setTimeout(() => { try { flush(); } catch { /* The form displays storageError and keeps typed input. */ } }, MATERIAL_DRAFT_SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [values, dirty, draft?.id, draft?.submission, restoring, restoreError, flush]);

  useEffect(() => {
    if (!focused) { try { flush(); } catch { /* Retry when the user returns. */ } }
  }, [focused, flush]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') { try { flush(); } catch { /* No background network request. */ } }
      else if (mounted.current) recheckFiles((value) => value + 1);
    });
    return () => subscription.remove();
  }, [flush]);

  const change = (patch: Partial<CreateMaterialInput>) => {
    if (!ready.current || completed.current || persisted.current?.submission !== 'editing') return;
    currentValues.current = { ...currentValues.current, ...patch };
    dirtyRef.current = true;
    setValues(currentValues.current); setDirty(true);
  };

  const attachImages = (images: LocalMaterialImage[]) => {
    const saved = flush();
    const retained = retainMaterialDraftImages(saved, images);
    change({ images: [...currentValues.current.images, ...retained] });
    flush();
  };

  const beginSubmission = (): MaterialDraft => {
    const saved = flush();
    if (saved.submission !== 'editing') return saved;
    if (missingMaterialDraftImages(saved).length) throw new ApiError('불러오지 못한 사진을 제외하거나 다시 첨부해 주세요.', 'validation', 422);
    const canonical: CreateMaterialInput = { ...currentValues.current, title: currentValues.current.title.trim(),
      subject: currentValues.current.subject.trim(), content: currentValues.current.content.trim() };
    let next: MaterialDraft;
    try { next = persistMaterialDraft(saved, canonical, 'pending'); }
    catch (error) { setStorageError(error instanceof Error ? error.message : '등록 전 임시 저장하지 못했어요.'); throw error; }
    currentValues.current = inputOf(next);
    accept(next); setValues(currentValues.current);
    return next;
  };

  const finishSubmission = (materialId: string): string | null => {
    const saved = persisted.current;
    if (!saved) return null;
    completed.current = true; dirtyRef.current = false;
    try {
      try { accept(persistMaterialDraft(saved, inputOf(saved), 'submitted', materialId)); }
      catch { /* The durable pending key still lets a later lookup recover the confirmed result. */ }
      discardMaterialDraft(owner, saved.id);
      useMaterialDraftStore.getState().publish(owner, null);
      return null;
    } catch {
      if (mounted.current) useMaterialDraftStore.getState().refresh(owner);
      return '자료를 등록했어요. 기기의 임시 저장본 정리가 남아 있어 목록에서 다시 확인해 주세요.';
    }
  };

  const allowEditingAfterRejection = () => {
    const saved = persisted.current;
    if (!saved || saved.submission !== 'pending') return;
    try { accept(persistMaterialDraft(saved, inputOf(saved), 'editing')); }
    catch (error) { if (mounted.current) setStorageError(error instanceof Error ? error.message : '임시 저장 상태를 확인해 주세요.'); }
  };

  const discard = () => {
    discardMaterialDraft(owner, restoreError ? undefined : persisted.current?.id);
    useMaterialDraftStore.getState().publish(owner, null);
    persisted.current = null; dirtyRef.current = false;
    setDraft(null); setDirty(false); setStorageError(null);
    reload();
  };

  return { draft, values, restoring, restoreError, storageError, dirty, change, flush, reload, attachImages,
    beginSubmission, finishSubmission, allowEditingAfterRejection, discard, missingImages: draft ? missingMaterialDraftImages(draft, values.images) : [] };
}
