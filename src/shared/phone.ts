/**
 * Indian phone number handling.
 *
 * Every phone number is normalised to E.164 (+919876543210) before it is stored,
 * hashed, rate-limited or compared. Users type numbers a dozen different ways —
 * "98765 43210", "098765-43210", "+91 98765 43210" — and each spelling must map
 * to the same account and the same rate-limit bucket.
 *
 * Scope is deliberately India-only. A general-purpose library is a dependency we
 * do not need while we operate in one country; the moment that changes, swap this
 * file for libphonenumber-js.
 */

export const INDIA_DIAL_CODE = "+91";

/** Indian mobile numbers are 10 digits and start with 6, 7, 8 or 9. */
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export type PhoneParseResult =
  | { ok: true; e164: string; national: string }
  | { ok: false; reason: string };

/**
 * Accepts the common spellings and returns E.164, or an explanation.
 * Anything not recognisable as an Indian mobile number is rejected — landlines
 * cannot receive an OTP, so accepting them would only fail later.
 */
export function parseIndianPhone(input: string): PhoneParseResult {
  if (!input) {
    return { ok: false, reason: "Enter your mobile number" };
  }

  let digits = input.replace(/[\s()\-.]/g, "");

  if (digits.startsWith("+91")) digits = digits.slice(3);
  else if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);

  digits = digits.replace(/\D/g, "");

  if (digits.length !== 10) {
    return { ok: false, reason: "Enter a 10-digit mobile number" };
  }

  if (!INDIAN_MOBILE.test(digits)) {
    return { ok: false, reason: "Enter a valid Indian mobile number" };
  }

  return { ok: true, e164: `${INDIA_DIAL_CODE}${digits}`, national: digits };
}

/** Throwing variant for call sites that have already validated the input. */
export function toE164(input: string): string {
  const parsed = parseIndianPhone(input);
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.e164;
}

export function isValidIndianPhone(input: string): boolean {
  return parseIndianPhone(input).ok;
}

/** Display form: "+91 98765 43210". */
export function formatPhone(e164: string): string {
  const national = e164.replace(/^\+91/, "");
  if (national.length !== 10) return e164;
  return `${INDIA_DIAL_CODE} ${national.slice(0, 5)} ${national.slice(5)}`;
}

/**
 * Partially masked form for confirmation screens and support transcripts:
 * "+91 98••• ••210".
 */
export function maskPhone(e164: string): string {
  const national = e164.replace(/^\+91/, "");
  if (national.length !== 10) return e164;
  return `${INDIA_DIAL_CODE} ${national.slice(0, 2)}••• ••${national.slice(7)}`;
}
