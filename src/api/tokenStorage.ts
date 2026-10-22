import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'ai-study.access-token';
const REFRESH_TOKEN_KEY = 'ai-study.refresh-token';

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
}

export interface AuthSessionSnapshot {
  accessToken: string | null;
  version: number;
}

// Serialize keychain reads/writes so an old deletion cannot finish after a new
// login has saved its credentials. Versions change as soon as a write is queued.
let sessionVersion = 0;
let operations: Promise<void> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = operations.then(operation);
  operations = result.then(() => undefined, () => undefined);
  return result;
}

export function getAuthSessionVersion(): number { return sessionVersion; }

export function getAuthSessionSnapshot(): Promise<AuthSessionSnapshot> {
  const version = sessionVersion;
  return serialize(async () => ({ accessToken: await SecureStore.getItemAsync(ACCESS_TOKEN_KEY), version }));
}

export async function getAccessToken(): Promise<string | null> {
  return (await getAuthSessionSnapshot()).accessToken;
}

export function getAuthTokens(): Promise<AuthTokens | null> {
  return serialize(async () => {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY), SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
    ]);
    return accessToken ? (refreshToken ? { accessToken, refreshToken } : { accessToken }) : null;
  });
}

async function deleteTokens(): Promise<void> {
  // Wait for both deletions even if one fails, before allowing the next write.
  const results = await Promise.allSettled([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY), SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
  const failed = results.find((result) => result.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}

export function saveAuthTokens(tokens: AuthTokens): Promise<void> {
  sessionVersion++;
  return serialize(async () => {
    try {
      await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
      if (tokens.refreshToken) await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
      else await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    } catch (error) {
      await deleteTokens().catch(() => undefined);
      throw error;
    }
  });
}

export function clearAuthTokens(): Promise<void> {
  sessionVersion++;
  return serialize(deleteTokens);
}

/** A 401 can invalidate only the session that actually sent that request. */
export async function invalidateAuthSession(expectedVersion: number): Promise<number | null> {
  if (sessionVersion !== expectedVersion) return null;
  const invalidatedVersion = ++sessionVersion;
  await serialize(deleteTokens).catch(() => undefined);
  return invalidatedVersion;
}
