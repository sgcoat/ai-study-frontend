import { ApiError } from './apiError';
import type { ApiRequestConfig, ApiTransport } from './apiClient';

export type MockRouteHandler = (
  config: ApiRequestConfig,
) => unknown | Promise<unknown>;

export type MockRouteTable = ReadonlyMap<string, MockRouteHandler>;

export function getMockRouteKey(method: string, path: string): string {
  const normalizedPath = (path.split('?')[0] ?? '').replace(/^\/+|\/+$/g, '');
  return `${method.toUpperCase()} /${normalizedPath}`;
}

/** Creates a route-driven mock transport; feature modules own their mock data. */
export function createMockTransport(routes: MockRouteTable): ApiTransport {
  return {
    async request<TResponse>(config: ApiRequestConfig): Promise<TResponse> {
      const method = (config.method ?? 'GET').toUpperCase();
      const path = config.url ?? '/';
      const handler = routes.get(getMockRouteKey(method, path));

      if (!handler) {
        throw new ApiError(
          `Mock route is not configured: ${method} ${path}`,
          'not_found',
          404,
          'MOCK_ROUTE_NOT_CONFIGURED',
        );
      }

      return (await handler(config)) as TResponse;
    },
  };
}
