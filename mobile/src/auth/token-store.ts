import * as SecureStore from "expo-secure-store";

/**
 * Token custody.
 *
 * The refresh token (60 days) lives in SecureStore — the Android Keystore-backed
 * store — so a session survives app restarts. The access token (15 minutes) is
 * kept in memory only; losing it on restart just costs one refresh call.
 */

const REFRESH_KEY = "gharr.refreshToken";

let accessToken: string | null = null;
let refreshToken: string | null = null;

export async function loadStoredSession(): Promise<boolean> {
  refreshToken = await SecureStore.getItemAsync(REFRESH_KEY);
  return refreshToken !== null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getRefreshToken(): string | null {
  return refreshToken;
}

export async function saveTokens(tokens: { accessToken: string; refreshToken: string }): Promise<void> {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken);
}

export async function clearTokens(): Promise<void> {
  accessToken = null;
  refreshToken = null;
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
