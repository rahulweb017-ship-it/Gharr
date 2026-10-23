import type { AuthResult, SendOtpResult } from "@/shared/contracts/auth";
import type { ProfileUpdateInput } from "@/shared/contracts/address";
import { api } from "./client";
import type { Address } from "./addresses";

/** GET /auth/me — src/server/services/auth.service.ts getCurrentUser. */
export interface Me {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  roles: string[];
  memberSince: string;
  addresses: Address[];
  orderCount: number;
  bookingCount: number;
}

export const authApi = {
  sendOtp: (phone: string) => api.post<SendOtpResult>("/auth/send-otp", { phone }),
  verifyOtp: (input: { phone: string; code: string; name?: string }) =>
    api.post<Required<AuthResult>>("/auth/verify-otp", input),
  logout: (refreshToken: string | null) =>
    api.post<{ signedOut: true }>("/auth/logout", refreshToken ? { refreshToken } : {}),
  me: () => api.get<Me>("/auth/me"),
  updateProfile: (input: ProfileUpdateInput) => api.patch<Me>("/auth/me", input),
};
