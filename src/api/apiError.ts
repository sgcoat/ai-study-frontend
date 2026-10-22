import axios, { type AxiosError } from 'axios';

export type ApiErrorKind =
  | 'network'
  | 'unauthorized'
  | 'validation'
  | 'not_found'
  | 'server'
  | 'http'
  | 'unknown';

export class ApiError extends Error {
  readonly name = 'ApiError';

  constructor(
    message: string,
    readonly kind: ApiErrorKind,
    readonly status?: number,
    readonly code?: string,
    readonly details?: unknown,
    readonly retryable = false,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function defaultMessage(kind: ApiErrorKind): string {
  switch (kind) {
    case 'network':
      return '서버에 연결할 수 없습니다. 네트워크 연결을 확인해 주세요.';
    case 'unauthorized':
      return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
    case 'validation':
      return '입력한 내용을 확인해 주세요.';
    case 'not_found':
      return '요청한 정보를 찾을 수 없습니다.';
    case 'server':
      return '서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    case 'http':
    case 'unknown':
      return '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (!axios.isAxiosError(error)) {
    return new ApiError(defaultMessage('unknown'), 'unknown');
  }

  const axiosError = error as AxiosError<unknown>;
  const status = axiosError.response?.status;
  const responseBody = axiosError.response?.data;
  const serverMessage =
    isRecord(responseBody) && typeof responseBody.message === 'string'
      ? responseBody.message
      : undefined;
  const serverCode =
    isRecord(responseBody) && typeof responseBody.code === 'string'
      ? responseBody.code
      : axiosError.code;
  const details = isRecord(responseBody) ? responseBody.details : undefined;

  let kind: ApiErrorKind;
  if (!axiosError.response) {
    kind = 'network';
  } else if (status === 401) {
    kind = 'unauthorized';
  } else if (status === 404) {
    kind = 'not_found';
  } else if (status === 400 || status === 422) {
    kind = 'validation';
  } else if (status === 408 || status === 429 || (status !== undefined && status >= 500)) {
    kind = 'server';
  } else {
    kind = 'http';
  }

  const retryable =
    kind === 'network' ||
    kind === 'server' ||
    status === 408 ||
    status === 429;

  return new ApiError(
    serverMessage || defaultMessage(kind),
    kind,
    status,
    serverCode,
    details,
    retryable,
  );
}
