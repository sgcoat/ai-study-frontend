import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios';

import { API_BASE_URL, API_TIMEOUT_MS } from './apiConfig';
import { toApiError } from './apiError';
import { getAuthSessionSnapshot, getAuthSessionVersion, invalidateAuthSession } from './tokenStorage';

export interface ApiRequestConfig<D = unknown> extends AxiosRequestConfig<D> {
  /** Set for login and verification calls so they never receive a saved bearer token. */
  skipAuth?: boolean;
  /** Set when a 401 is an expected response, such as an invalid one-time code. */
  skipUnauthorizedHandler?: boolean;
}

type InternalApiRequestConfig = InternalAxiosRequestConfig &
  Pick<ApiRequestConfig, 'skipAuth' | 'skipUnauthorizedHandler'> & { authSessionVersion?: number };

export type UnauthorizedHandler = (sessionVersion: number) => void | Promise<void>;

let unauthorizedHandler: UnauthorizedHandler | undefined;

/** Register an app-level callback without coupling the HTTP layer to navigation. */
export function registerUnauthorizedHandler(
  handler: UnauthorizedHandler,
): () => void {
  unauthorizedHandler = handler;

  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = undefined;
  };
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: {
    Accept: 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const apiConfig = config as InternalApiRequestConfig;
  if (apiConfig.skipAuth) {
    config.headers.delete('Authorization');
    return config;
  }

  const session = await getAuthSessionSnapshot();
  if (session.accessToken) {
    config.headers.set('Authorization', `Bearer ${session.accessToken}`);
    apiConfig.authSessionVersion = session.version;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    const apiError = toApiError(error);
    const requestConfig = (axios.isAxiosError(error)
      ? error.config
      : undefined) as InternalApiRequestConfig | undefined;

    if (
      apiError.status === 401 &&
      !requestConfig?.skipUnauthorizedHandler &&
      requestConfig?.authSessionVersion !== undefined
    ) {
      const invalidatedVersion = await invalidateAuthSession(requestConfig.authSessionVersion);
      if (invalidatedVersion !== null && getAuthSessionVersion() === invalidatedVersion) {
        await Promise.resolve(unauthorizedHandler?.(invalidatedVersion)).catch(() => undefined);
      }
    }

    return Promise.reject(apiError);
  },
);

/**
 * Feature API modules use this boundary so tests and mock services can supply
 * another transport without changing screens or domain types.
 */
export interface ApiTransport {
  request<TResponse>(config: ApiRequestConfig): Promise<TResponse>;
}

export function createAxiosTransport(client: AxiosInstance): ApiTransport {
  return {
    async request<TResponse>(config: ApiRequestConfig): Promise<TResponse> {
      const response = await client.request<TResponse>(config);
      return response.data;
    },
  };
}
