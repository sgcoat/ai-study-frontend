import { AxiosHeaders } from 'axios';

import { apiClient, createAxiosTransport, type ApiRequestConfig, type ApiTransport } from './apiClient';
import { getAccessToken } from './tokenStorage';
import {
  createMockTransport,
  getMockRouteKey,
  type MockRouteHandler,
} from './mockTransport';

/** Mock mode is the default until the backend contract is connected. */
export const API_MODE =
  process.env.EXPO_PUBLIC_API_MODE?.trim().toLowerCase() === 'http'
    ? 'http'
    : 'mock';

const httpTransport = createAxiosTransport(apiClient);
const mockRoutes = new Map<string, MockRouteHandler>();
const mockTransport = createMockTransport(mockRoutes);

/** Feature modules register their mock endpoints here while the backend is pending. */
export function registerMockRoute(
  method: string,
  path: string,
  handler: MockRouteHandler,
): void {
  mockRoutes.set(getMockRouteKey(method, path), handler);
}

export function clearMockRoutes(): void {
  mockRoutes.clear();
}

/** Stable transport reference that can be imported by feature API modules. */
export const apiTransport: ApiTransport = {
  async request<TResponse>(config: ApiRequestConfig): Promise<TResponse> {
    if (API_MODE === 'http') {
      return httpTransport.request<TResponse>(config);
    }

    const headers = AxiosHeaders.from(
      config.headers as Parameters<typeof AxiosHeaders.from>[0],
    );
    if (!config.skipAuth) {
      const accessToken = await getAccessToken();
      if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return mockTransport.request<TResponse>({ ...config, headers });
  },
};
