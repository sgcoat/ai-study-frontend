import { ApiError, toApiError } from '../../../api/apiError';
import { API_MODE } from '../../../api/transport';
import { getCurrentUser, logout } from '../api/authApi';

declare const __DEV__: boolean;

export function canCheckSessionExpiry(): boolean {
  return typeof __DEV__ !== 'undefined' && __DEV__ && API_MODE === 'http';
}

/** Revoke only this device's bearer session, then exercise the normal 401 flow. */
export async function checkSessionExpiry(): Promise<void> {
  if (!canCheckSessionExpiry()) throw new ApiError('개발 모드의 서버 연결에서만 사용할 수 있어요.', 'validation', 403, 'DEVELOPMENT_ONLY');
  try { await logout(); }
  catch (error) { if (toApiError(error).status !== 401) throw error; }
  try { await getCurrentUser(); }
  catch (error) {
    if (toApiError(error).status === 401) return;
    throw error;
  }
  throw new ApiError('로그인 상태가 아직 유효해요. 서버 연결을 확인한 뒤 다시 점검해 주세요.', 'server', undefined, 'SESSION_EXPIRY_CHECK_FAILED');
}
