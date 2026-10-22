const configuredBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

/**
 * EXPO_PUBLIC_* 값은 앱 번들에서 확인할 수 있으므로 백엔드 URL처럼 공개 가능한 값만 둡니다.
 * 실기기에서는 localhost 대신 개발 컴퓨터의 LAN 주소를 지정해야 합니다.
 */
export const API_BASE_URL =
  configuredBaseUrl || 'http://localhost:3000/api/v1';

export const API_TIMEOUT_MS = 30_000;
