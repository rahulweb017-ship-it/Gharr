import { z } from "zod";
import { parseIndianPhone } from "@/shared/phone";

/**
 * Auth contracts.
 *
 * These schemas are the single source of truth for the API's input validation,
 * the web forms' validation, and the types the React Native app will import.
 * One definition means the three can never disagree.
 */

/** Normalises to E.164 during parsing, so services only ever see +91XXXXXXXXXX. */
export const PhoneInput = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const parsed = parseIndianPhone(value);
    if (!parsed.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.reason });
      return z.NEVER;
    }
    return parsed.e164;
  });

export const SendOtpInput = z.object({
  phone: PhoneInput,
});
export type SendOtpInput = z.infer<typeof SendOtpInput>;

export const SendOtpResult = z.object({
  sent: z.literal(true),
  expiresAt: z.string(),
  /** Present only while SMS_PROVIDER=console and OTP_DEV_ECHO=true (never in production). */
  devCode: z.string().optional(),
});
export type SendOtpResult = z.infer<typeof SendOtpResult>;

export const VerifyOtpInput = z.object({
  phone: PhoneInput,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
  /** Optional, captured on first sign-in so the account is not nameless. */
  name: z.string().trim().min(2).max(60).optional(),
});
export type VerifyOtpInput = z.infer<typeof VerifyOtpInput>;

export const SessionUser = z.object({
  id: z.string(),
  phone: z.string(),
  name: z.string().nullable(),
  roles: z.array(z.string()),
  isNewUser: z.boolean(),
});
export type SessionUser = z.infer<typeof SessionUser>;

export const AuthResult = z.object({
  user: SessionUser,
  /** Returned in the body for mobile clients; web reads them from cookies. */
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
});
export type AuthResult = z.infer<typeof AuthResult>;

export const RefreshInput = z.object({
  refreshToken: z.string().optional(),
});
export type RefreshInput = z.infer<typeof RefreshInput>;
