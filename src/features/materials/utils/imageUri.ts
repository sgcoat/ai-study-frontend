import { API_BASE_URL } from '../../../api/apiConfig';

/** Backend relative paths are assumed to be relative to the server origin. */
export function resolveMaterialImageUri(path: string): string {
  if (/^(https?:|file:|content:|data:|blob:)/i.test(path)) return path;
  const origin = new URL(API_BASE_URL).origin;
  if (path.startsWith('//')) return `${new URL(API_BASE_URL).protocol}${path}`;
  return `${origin}/${path.replace(/^\/+/, '')}`;
}

/** Renew signed image URLs while a material stays open. */
export function imageUrlRefreshInterval(paths: string[] = []): number | false {
  const expiries = paths.flatMap((path) => {
    try {
      const value = new URL(resolveMaterialImageUri(path)).searchParams.get('expires');
      const seconds = Number(value);
      return value && Number.isFinite(seconds) && seconds > 0 ? [seconds * 1000] : [];
    } catch { return []; }
  });
  return expiries.length ? Math.max(30000, Math.min(...expiries) - Date.now() - 60000) : false;
}
