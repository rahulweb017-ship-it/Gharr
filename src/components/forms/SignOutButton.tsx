"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { apiPost } from "@/lib/api-client";

/**
 * Sign out.
 *
 * Calls the API rather than just clearing cookies client-side, because the
 * refresh token has to be revoked server-side — a cleared cookie alone would
 * leave a valid 60-day token in existence.
 */
export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    await apiPost("/auth/logout");
    setBusy(false);
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={busy}
      className="flex min-h-13 w-full items-center gap-3 rounded-(--radius-card) border border-red-100 bg-red-50/60 px-4 py-3 text-left text-[15px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-60"
    >
      {busy ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <LogOut aria-hidden className="size-5" />}
      Logout
    </button>
  );
}
