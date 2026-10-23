import { env } from "@/server/env";
import { banner, logger } from "@/server/logger";
import { formatPhone } from "@/shared/phone";

/**
 * SMS delivery behind a one-method interface.
 *
 * During development nothing is sent: the OTP is printed to the server terminal.
 * Switching to a real Indian provider (MSG91, Twilio) is an env change plus one
 * new file implementing this interface — no call site changes.
 */

export type SmsTemplate =
  | "OTP_LOGIN"
  | "ORDER_CONFIRMED"
  | "ORDER_DISPATCHED"
  | "ORDER_DELIVERED"
  | "BOOKING_REQUESTED"
  | "BOOKING_ACCEPTED"
  | "BOOKING_REMINDER";

export interface SmsProvider {
  readonly key: string;
  send(
    phoneE164: string,
    template: SmsTemplate,
    vars: Record<string, string>,
  ): Promise<void>;
}

const TEMPLATE_TEXT: Record<SmsTemplate, (v: Record<string, string>) => string> = {
  OTP_LOGIN: (v) => `${v.code} is your Gharr verification code. Valid for 5 minutes. Do not share it with anyone.`,
  ORDER_CONFIRMED: (v) => `Gharr: order ${v.orderNumber} confirmed. Track it in the app.`,
  ORDER_DISPATCHED: (v) => `Gharr: order ${v.orderNumber} has been dispatched and arrives ${v.eta}.`,
  ORDER_DELIVERED: (v) => `Gharr: order ${v.orderNumber} delivered. Thank you!`,
  BOOKING_REQUESTED: (v) => `Gharr: new job request for ${v.date} at ${v.time}. Open the app to accept.`,
  BOOKING_ACCEPTED: (v) => `Gharr: ${v.workerName} accepted your booking for ${v.date} at ${v.time}.`,
  BOOKING_REMINDER: (v) => `Gharr: reminder — ${v.workerName} arrives tomorrow at ${v.time}.`,
};

/** Development provider: prints to the terminal instead of sending. */
class ConsoleSmsProvider implements SmsProvider {
  readonly key = "console";

  async send(
    phoneE164: string,
    template: SmsTemplate,
    vars: Record<string, string>,
  ): Promise<void> {
    const body = TEMPLATE_TEXT[template](vars);

    if (template === "OTP_LOGIN") {
      // The OTP gets a banner because it is read dozens of times a day while
      // building the auth flow and must not be lost among query logs.
      banner([
        "GHARR — verification code",
        "",
        `  Phone : ${formatPhone(phoneE164)}`,
        `  Code  : ${vars.code}`,
        "",
        "Valid for 5 minutes.",
      ]);
      return;
    }

    logger.info({ to: formatPhone(phoneE164), template, body }, "SMS (console)");
  }
}

/**
 * MSG91 — the usual choice for Indian transactional SMS. Left as a skeleton
 * because DLT template registration and a sender ID have to exist first.
 */
class Msg91SmsProvider implements SmsProvider {
  readonly key = "msg91";

  async send(): Promise<void> {
    throw new Error(
      "MSG91 provider is not implemented yet. Register DLT templates, then set MSG91_AUTH_KEY, MSG91_SENDER_ID and MSG91_TEMPLATE_ID.",
    );
  }
}

let cached: SmsProvider | undefined;

export function getSmsProvider(): SmsProvider {
  if (cached) return cached;

  switch (env.SMS_PROVIDER) {
    case "msg91":
    case "twilio":
      cached = new Msg91SmsProvider();
      break;
    default:
      cached = new ConsoleSmsProvider();
  }

  return cached;
}
