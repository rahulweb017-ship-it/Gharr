import { z } from "zod";

/**
 * Environment is parsed once, at boot, and the process refuses to start if it is
 * wrong. A missing JWT secret should be a startup crash, not a 500 on the first
 * login attempt at 2am.
 */
const booleanish = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const EnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_BASE_URL: z.string().url().default("http://localhost:3000"),
    DEFAULT_CITY: z.string().default("Hyderabad"),
    LOG_LEVEL: z
      .enum(["debug", "info", "warn", "error"])
      .default("debug"),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    TEST_DATABASE_URL: z.string().optional(),

    JWT_SECRET: z
      .string()
      .min(32, "JWT_SECRET must be at least 32 characters"),
    OTP_PEPPER: z
      .string()
      .min(16, "OTP_PEPPER must be at least 16 characters"),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(60),

    SMS_PROVIDER: z.enum(["console", "msg91", "twilio"]).default("console"),
    OTP_DEV_ECHO: booleanish,
    DEV_PHONE_PREFIX: z.string().default("+9190000000"),

    PAYMENT_PROVIDER: z.enum(["cod", "mock", "razorpay"]).default("mock"),
    MOCK_PAYMENT_SECRET: z.string().default("mock-webhook-secret"),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

    MATERIAL_COMMISSION_PERCENT: z.coerce.number().min(0).max(100).default(8),
    LABOUR_COMMISSION_PERCENT: z.coerce.number().min(0).max(100).default(12),
    /** Ceiling per order. Guards the Int-paise columns against overflow. */
    MAX_ORDER_PAISE: z.coerce.number().int().positive().default(1_000_000_000),

    PRIVATE_STORAGE_DIR: z.string().default("./storage/private"),
    SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  })
  .superRefine((env, ctx) => {
    // `next build` runs with NODE_ENV=production while still reading the local
    // .env, so these runtime guards would otherwise make the app impossible to
    // build from a development machine. No requests are served during the build,
    // so skipping them here costs nothing — the same checks still run when the
    // server actually boots.
    if (process.env.NEXT_PHASE === "phase-production-build") return;

    // Dev conveniences that would be catastrophic in production are refused at
    // boot rather than trusted to reviewer vigilance.
    if (env.NODE_ENV === "production") {
      if (env.OTP_DEV_ECHO) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "OTP_DEV_ECHO must be false in production",
          path: ["OTP_DEV_ECHO"],
        });
      }
      if (env.SMS_PROVIDER === "console") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "SMS_PROVIDER cannot be 'console' in production — nobody receives the OTP",
          path: ["SMS_PROVIDER"],
        });
      }
      if (env.PAYMENT_PROVIDER === "mock") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "PAYMENT_PROVIDER cannot be 'mock' in production",
          path: ["PAYMENT_PROVIDER"],
        });
      }
    }

    if (env.PAYMENT_PROVIDER === "razorpay") {
      if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are required when PAYMENT_PROVIDER=razorpay",
          path: ["RAZORPAY_KEY_ID"],
        });
      }
    }
  });

function loadEnv() {
  const parsed = EnvSchema.safeParse(process.env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }

  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === "production";
export const isDevelopment = env.NODE_ENV === "development";
export const isTest = env.NODE_ENV === "test";

export type Env = typeof env;
