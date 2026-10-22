import { create } from 'zustand';

import { ApiError, toApiError } from '../../../api/apiError';
import { allowAccountData } from '../../../api/accountDataAccess';
import {
  clearAuthTokens,
  getAuthTokens,
  getAuthSessionVersion,
  saveAuthTokens,
} from '../../../api/tokenStorage';
import type { User } from '../../../types';
import {
  getCurrentUser,
  logout,
  deleteCurrentAccount,
  requestLoginCode,
  verifyLoginCode,
} from '../api/authApi';
import { codeTiming, type CodeTiming } from '../hooks/useCodeTimer';
import { cleanupDeletedAccount, clearPendingDeletion, markPendingDeletion, pendingDeletion, resetStudyMemory } from '../services/accountCleanup';

export type AuthStatus =
  | 'restoring'
  | 'restoreError'
  | 'signedOut'
  | 'signedIn';

interface AuthState {
  status: AuthStatus;
  user: User | null;
  pendingEmail: string | null;
  codeDelivery: 'email' | 'console';
  codeTiming: CodeTiming | null;
  restoreError: string | null;
  notice: string | null;
  restoreSession: () => Promise<void>;
  requestCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: (code: string) => Promise<void>;
  handleUnauthorized: (sessionVersion: number) => Promise<void>;
}

const expiredSessionNotice = '로그인이 만료되었어요. 같은 이메일로 다시 로그인하면 작성 중인 자료를 이어서 사용할 수 있어요.';

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'restoring',
  user: null,
  pendingEmail: null,
  codeDelivery: 'email',
  codeTiming: null,
  restoreError: null,
  notice: null,

  restoreSession: async () => {
    const initialVersion = getAuthSessionVersion();
    set({ status: 'restoring', restoreError: null });

    try {
      const deletion = await pendingDeletion();
      if (deletion?.confirmed) await cleanupDeletedAccount(deletion.ownerId);
      const tokens = await getAuthTokens();
      if (getAuthSessionVersion() !== initialVersion) return;
      if (!tokens?.accessToken) {
        if (deletion && !deletion.confirmed) await cleanupDeletedAccount(deletion.ownerId);
        set({ status: 'signedOut', user: null, pendingEmail: null });
        return;
      }

      const user = await getCurrentUser();
      if (getAuthSessionVersion() !== initialVersion) return;
      allowAccountData(user.id);
      // A valid session confirms that an uncertain delete request did not revoke this session.
      await clearPendingDeletion();
      if (getAuthSessionVersion() !== initialVersion) return;
      set({ status: 'signedIn', user, pendingEmail: null, restoreError: null });
    } catch (error) {
      if (getAuthSessionVersion() !== initialVersion) return;
      const apiError = toApiError(error);

      if (apiError.kind === 'unauthorized') {
        await clearAuthTokens().catch(() => undefined);
        try {
          const pending = await pendingDeletion();
          if (pending) await cleanupDeletedAccount(pending.ownerId);
        } catch {
          set({ status: 'restoreError', restoreError: '기기에 남은 계정 데이터를 정리하지 못했습니다. 저장 공간을 확인하고 다시 시도해 주세요.' });
          return;
        }
        set({
          status: 'signedOut',
          user: null,
          pendingEmail: null,
          restoreError: null,
          notice: expiredSessionNotice,
        });
        return;
      }

      set({ status: 'restoreError', restoreError: apiError.message });
    }
  },

  requestCode: async (email) => {
    const response = await requestLoginCode(email);
    set({ notice: null, pendingEmail: email, codeDelivery: response.deliveryMode ?? 'email',
      codeTiming: codeTiming(response.expiresInSeconds, response.resendAfterSeconds) });
  },

  verifyCode: async (email, code) => {
    const initialVersion = getAuthSessionVersion();
    const pending = await pendingDeletion();
    if (pending?.confirmed) await cleanupDeletedAccount(pending.ownerId);
    const response = await verifyLoginCode(email, code);
    if (getAuthSessionVersion() !== initialVersion) return;
    const saving = saveAuthTokens({
      accessToken: response.accessToken,
      refreshToken: response.refreshToken,
    });
    const savedVersion = getAuthSessionVersion();
    await saving;
    if (getAuthSessionVersion() !== savedVersion) return;
    allowAccountData(response.user.id);
    set({
      status: 'signedIn',
      user: response.user,
      pendingEmail: null,
      codeTiming: null,
      restoreError: null,
      notice: null,
    });
  },

  signOut: async () => {
    const initialVersion = getAuthSessionVersion();
    await logout().catch(() => undefined);
    if (getAuthSessionVersion() !== initialVersion) return;
    const clearing = clearAuthTokens();
    const clearedVersion = getAuthSessionVersion();
    await clearing;
    if (getAuthSessionVersion() !== clearedVersion) return;
    resetStudyMemory();
    set({
      status: 'signedOut',
      user: null,
      pendingEmail: null,
      restoreError: null,
      notice: null,
    });
  },

  deleteAccount: async (code) => {
    const user = get().user;
    if (!user) throw new ApiError('로그인이 필요합니다.', 'unauthorized', 401);
    await markPendingDeletion(user.id);
    try { await deleteCurrentAccount(code); }
    catch (error) {
      const apiError = toApiError(error);
      // A network error may mean the server deleted the account but the response was lost.
      if (apiError.status && apiError.status !== 401 && apiError.status < 500) await clearPendingDeletion();
      throw error;
    }
    let notice = '계정이 삭제되었습니다. 다시 로그인하면 새 계정이 만들어집니다.';
    try {
      await markPendingDeletion(user.id, true);
      await clearAuthTokens();
      await cleanupDeletedAccount(user.id);
    } catch { notice = '계정이 삭제되었습니다. 기기에 남은 데이터 정리는 앱을 다시 실행하면 재시도합니다.'; }
    finally {
      resetStudyMemory();
      set({ status: 'signedOut', user: null, pendingEmail: null, codeTiming: null, restoreError: null, notice });
    }
  },

  handleUnauthorized: async (sessionVersion) => {
    if (getAuthSessionVersion() !== sessionVersion) return;
    try {
      const pending = await pendingDeletion();
      if (getAuthSessionVersion() !== sessionVersion) return;
      if (pending) await cleanupDeletedAccount(pending.ownerId);
    } catch { /* Preserve the marker for cleanup on the next launch. */ }
    finally {
      if (getAuthSessionVersion() !== sessionVersion) return;
      resetStudyMemory();
      set({ status: 'signedOut', user: null, pendingEmail: null, codeTiming: null, restoreError: null, notice: expiredSessionNotice });
    }
  },
}));

export function getAuthActionErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return toApiError(error).message;
}
