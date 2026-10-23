import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

/**
 * Where the Gharr API lives.
 *
 * Set EXPO_PUBLIC_API_URL in mobile/.env. The fallback guesses the dev machine:
 * the Android emulator reaches the host at 10.0.2.2, and a phone running a dev
 * build can reach the Metro host's LAN IP — the backend must then be started
 * with `npm run dev:lan` so it listens on all interfaces.
 */
function guessDevBaseUrl(): string {
  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.20:8081"
  const host = hostUri?.split(":")[0];
  if (host && host !== "localhost" && host !== "127.0.0.1") return `http://${host}:3100`;
  return "http://10.0.2.2:3100";
}

const BUILT_IN_API_URL = (process.env.EXPO_PUBLIC_API_URL ?? guessDevBaseUrl()).replace(/\/$/, "");

/**
 * A plain-HTTP API is a dev backend on someone's PC, whose LAN IP changes with
 * the network. Only those builds let the user repoint the app at runtime; an
 * HTTPS (real) build always talks to the server it was built for.
 */
export const CAN_CHANGE_SERVER = BUILT_IN_API_URL.startsWith("http://");

const SERVER_KEY = "gharr.apiUrl";
let apiBaseUrl = BUILT_IN_API_URL;

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

/** Called once at launch, before any request, to apply a saved server address. */
export async function loadApiBaseUrl(): Promise<void> {
  if (!CAN_CHANGE_SERVER) return;
  const saved = await SecureStore.getItemAsync(SERVER_KEY).catch(() => null);
  if (saved) apiBaseUrl = saved;
}

/**
 * Accepts what a person would type — "10.187.140.61", "10.187.140.61:3100" or
 * a full URL — and returns a base URL, or null if it isn't one.
 */
export function normaliseServerInput(input: string): string | null {
  // React Native's URL polyfill has no setters, so parse by hand.
  const match = /^(?:(https?):\/\/)?([a-z0-9.-]+)(?::(\d{1,5}))?\/*$/i.exec(input.trim());
  if (!match) return null;
  const [, scheme = "http", host, port] = match;
  const protocol = scheme.toLowerCase();
  const withPort = port ?? (protocol === "http" ? "3100" : undefined);
  return `${protocol}://${host}${withPort ? `:${withPort}` : ""}`;
}

export async function setApiBaseUrl(url: string): Promise<void> {
  apiBaseUrl = url;
  if (url === BUILT_IN_API_URL) await SecureStore.deleteItemAsync(SERVER_KEY);
  else await SecureStore.setItemAsync(SERVER_KEY, url);
}
