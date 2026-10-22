import * as SecureStore from 'expo-secure-store';
import { Directory, Paths } from 'expo-file-system';
import { blockAccountData } from '../../../api/accountDataAccess';
import { useQuizStore } from '../../questions/store/quizStore';
import { useQuestionJobStore } from '../../questions/store/questionJobStore';
import { useSummaryJobStore } from '../../summaries/store/summaryJobStore';
import { useMaterialDraftStore } from '../../materials/store/materialDraftStore';

const PENDING_DELETION_KEY = 'ai-study.pending-account-deletion';
const namespaces = ['mock-materials-v1', 'mock-summaries-v1', 'mock-questions-v1',
  'summary-sessions-v1', 'question-jobs-v1', 'quiz-sessions-v1', 'material-cleanups-v1',
  'material-drafts-v1', 'mock-material-registrations-v1'];

export function resetStudyMemory(): void {
  useQuizStore.setState({ sessions: {}, latestSessions: {} });
  useQuestionJobStore.setState({ sessions: {} });
  useSummaryJobStore.setState({ sessions: {} });
  useMaterialDraftStore.setState({ summaries: {}, errors: {} });
}

interface PendingDeletion { ownerId: string; confirmed: boolean }
export async function markPendingDeletion(ownerId: string, confirmed = false): Promise<void> {
  await SecureStore.setItemAsync(PENDING_DELETION_KEY, JSON.stringify({ ownerId, confirmed }));
}
export async function pendingDeletion(): Promise<PendingDeletion | null> {
  const raw = await SecureStore.getItemAsync(PENDING_DELETION_KEY);
  if (!raw) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== 'object' || !('ownerId' in value) || typeof value.ownerId !== 'string' ||
    !value.ownerId || ['.', '..'].includes(value.ownerId) || !('confirmed' in value) || typeof value.confirmed !== 'boolean') {
    throw new Error('계정 삭제 정리 정보를 읽지 못했습니다.');
  }
  return value as PendingDeletion;
}
export async function clearPendingDeletion(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_DELETION_KEY);
}

/** A retained marker lets the next launch retry local cleanup after an interrupted response. */
export async function cleanupDeletedAccount(ownerId: string): Promise<void> {
  if (!ownerId || ['.', '..'].includes(ownerId)) throw new Error('계정 식별자를 확인하지 못했습니다.');
  blockAccountData(ownerId);
  resetStudyMemory();
  for (const namespace of namespaces) {
    const directory = new Directory(Paths.document, namespace, encodeURIComponent(ownerId));
    if (directory.exists) directory.delete();
  }
  const images = new Directory(Paths.cache, 'material-images-v1', encodeURIComponent(ownerId));
  if (images.exists) images.delete();
  await clearPendingDeletion();
}
