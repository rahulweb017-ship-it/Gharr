import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";

/**
 * Light status-bar icons while a screen with a navy top is focused, back to
 * the app-wide dark icons when it loses focus. A plain <StatusBar> element
 * would stick after switching tabs, because tab screens stay mounted.
 */
export function useLightStatusBar() {
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle("dark");
    }, []),
  );
}
