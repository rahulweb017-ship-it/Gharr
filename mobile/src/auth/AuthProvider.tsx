import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi, type Me } from "~/api/auth";
import { refreshSession, setSessionExpiredHandler } from "~/api/client";
import { loadApiBaseUrl } from "~/config";
import { clearTokens, getRefreshToken, loadStoredSession, saveTokens } from "./token-store";

type Status = "loading" | "signedIn" | "signedOut";

interface AuthContextValue {
  status: Status;
  user: Me | null;
  signIn: (input: { phone: string; code: string; name?: string }) => Promise<{ isNewUser: boolean }>;
  signOut: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("loading");
  const [user, setUser] = useState<Me | null>(null);

  const reloadUser = useCallback(async () => {
    setUser(await authApi.me());
  }, []);

  const forgetSession = useCallback(async () => {
    await clearTokens();
    queryClient.clear();
    setUser(null);
    setStatus("signedOut");
  }, [queryClient]);

  // Restore a session from SecureStore on launch.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // The saved server address must be in place before the first request.
        await loadApiBaseUrl();
        if ((await loadStoredSession()) && (await refreshSession())) {
          const me = await authApi.me();
          if (!cancelled) {
            setUser(me);
            setStatus("signedIn");
          }
          return;
        }
      } catch {
        // Fall through to signed-out; the login screen is always recoverable.
      }
      if (!cancelled) setStatus(getRefreshToken() ? "signedIn" : "signedOut");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => void forgetSession());
    return () => setSessionExpiredHandler(null);
  }, [forgetSession]);

  const signIn = useCallback<AuthContextValue["signIn"]>(async (input) => {
    const result = await authApi.verifyOtp(input);
    await saveTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    const me = await authApi.me();
    setUser(me);
    setStatus("signedIn");
    return { isNewUser: result.user.isNewUser };
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout(getRefreshToken());
    } catch {
      // Revocation is best-effort; the local session is cleared regardless.
    }
    await forgetSession();
  }, [forgetSession]);

  const value = useMemo(
    () => ({ status, user, signIn, signOut, reloadUser }),
    [status, user, signIn, signOut, reloadUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
