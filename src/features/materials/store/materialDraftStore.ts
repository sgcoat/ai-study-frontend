import { create } from 'zustand';
import { readMaterialDraft, hasMaterialDraftContent } from '../services/materialDraftStorage';
import type { MaterialDraft } from '../types';

export type MaterialDraftSummary = Pick<MaterialDraft, 'id' | 'title' | 'updatedAt' | 'submission'> & { imageCount: number };
interface DraftStore {
  summaries: Record<string, MaterialDraftSummary | null>;
  errors: Record<string, string | null>;
  publish: (owner: string, draft: MaterialDraft | null) => void;
  refresh: (owner: string) => void;
}
export const useMaterialDraftStore = create<DraftStore>((set, get) => ({
  summaries: {}, errors: {},
  publish: (owner, draft) => set((state) => ({ summaries: { ...state.summaries, [owner]: draft && hasMaterialDraftContent(draft)
    ? { id: draft.id, title: draft.title, updatedAt: draft.updatedAt, submission: draft.submission, imageCount: draft.images.length } : null },
  errors: { ...state.errors, [owner]: null } })),
  refresh: (owner) => {
    try { get().publish(owner, readMaterialDraft(owner)); }
    catch { set((state) => ({ summaries: { ...state.summaries, [owner]: null }, errors: { ...state.errors, [owner]: '임시 저장본을 불러오지 못했어요. 다시 확인해 주세요.' } })); }
  },
}));
