import { AxiosHeaders } from 'axios';

import { ApiError } from '../../../api/apiError';
import type { ApiRequestConfig } from '../../../api/apiClient';
import { apiTransport, registerMockRoute } from '../../../api/transport';
import type { AuthTokens } from '../../../api/tokenStorage';
import type { User } from '../../../types';

export interface RequestLoginCodeResponse {
  message?: string;
  expiresInSeconds?: number;
  resendAfterSeconds?: number;
  deliveryMode?: 'email' | 'console';
}

export interface VerifyLoginCodeResponse extends AuthTokens {
  user: User;
}

interface EmailRequest {
  email: string;
}

interface VerifyRequest extends EmailRequest {
  code: string;
}

// SMTP connection, authentication and acceptance can take longer than ordinary API reads.
const EMAIL_REQUEST_TIMEOUT_MS = 60_000;

export function requestLoginCode(email: string): Promise<RequestLoginCodeResponse> {
  return apiTransport.request<RequestLoginCodeResponse>({
    method: 'POST',
    url: '/auth/login',
    data: { email } satisfies EmailRequest,
    timeout: EMAIL_REQUEST_TIMEOUT_MS,
    skipAuth: true,
    skipUnauthorizedHandler: true,
  });
}

export function verifyLoginCode(
  email: string,
  code: string,
): Promise<VerifyLoginCodeResponse> {
  return apiTransport.request<VerifyLoginCodeResponse>({
    method: 'POST',
    url: '/auth/verify',
    data: { email, code } satisfies VerifyRequest,
    skipAuth: true,
    skipUnauthorizedHandler: true,
  });
}

export function getCurrentUser(): Promise<User> {
  return apiTransport.request<User>({
    method: 'GET',
    url: '/users/me',
  });
}

export function logout(): Promise<void> {
  return apiTransport.request<void>({ method: 'POST', url: '/auth/logout', timeout: 5000, skipUnauthorizedHandler: true });
}

export function requestAccountDeletionCode(): Promise<RequestLoginCodeResponse> {
  return apiTransport.request({ method: 'POST', url: '/users/me/deletion-code', data: {}, timeout: EMAIL_REQUEST_TIMEOUT_MS });
}

export function deleteCurrentAccount(code: string): Promise<void> {
  return apiTransport.request({ method: 'DELETE', url: '/users/me', data: { code } });
}

function createMockUser(email: string): User {
  return {
    id: `mock-user-${encodeURIComponent(email)}`,
    email,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

registerMockRoute('POST', '/auth/login', () => ({
  message: '인증 코드를 보냈습니다.',
  expiresInSeconds: 300,
  resendAfterSeconds: 60,
}));

registerMockRoute('POST', '/auth/logout', () => undefined);

registerMockRoute('POST', '/auth/verify', (config) => {
  const body = config.data as VerifyRequest;

  if (body.code !== '123456') {
    throw new ApiError(
      'mock 모드에서는 인증 코드 123456을 입력해 주세요.',
      'validation',
      422,
      'INVALID_CODE',
    );
  }

  return {
    accessToken: `mock-token:${encodeURIComponent(body.email)}`,
    refreshToken: `mock-refresh:${encodeURIComponent(body.email)}`,
    user: createMockUser(body.email),
  } satisfies VerifyLoginCodeResponse;
});

function mockCurrentUser(config: ApiRequestConfig): User {
  const authorization = AxiosHeaders.from(
    config.headers as Parameters<typeof AxiosHeaders.from>[0],
  ).get('Authorization');
  const prefix = 'Bearer mock-token:';

  if (typeof authorization !== 'string' || !authorization.startsWith(prefix)) {
    throw new ApiError(
      '로그인이 필요합니다.',
      'unauthorized',
      401,
      'UNAUTHENTICATED',
    );
  }

  try {
    const email = decodeURIComponent(authorization.slice(prefix.length));
    return createMockUser(email);
  } catch {
    throw new ApiError(
      '저장된 로그인 정보를 확인할 수 없습니다.',
      'unauthorized',
      401,
      'INVALID_MOCK_TOKEN',
    );
  }
}

registerMockRoute('GET', '/users/me', mockCurrentUser);
registerMockRoute('POST', '/users/me/deletion-code', (config) => {
  mockCurrentUser(config);
  return { expiresInSeconds: 300, resendAfterSeconds: 60, deliveryMode: 'email' } satisfies RequestLoginCodeResponse;
});
registerMockRoute('DELETE', '/users/me', (config) => {
  mockCurrentUser(config);
  if ((config.data as { code?: string }).code !== '123456') {
    throw new ApiError('mock 모드에서는 삭제 인증 코드 123456을 입력해 주세요.', 'validation', 422, 'INVALID_DELETION_CODE');
  }
  return undefined;
});
