import { PrismaClient } from "@prisma/client";
import { env, isProduction } from "@/server/env";

/**
 * Next dev-mode hot reload re-evaluates modules on every edit. Without a global
 * cache that would open a new connection pool each time and exhaust Postgres
 * within a few minutes of editing.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction
      ? ["error", "warn"]
      : env.LOG_LEVEL === "debug"
        ? ["query", "error", "warn"]
        : ["error", "warn"],
  });

if (!isProduction) {
  globalForPrisma.prisma = prisma;
}

/** Transaction client type — services accept this so they compose inside $transaction. */
export type Tx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export type Db = PrismaClient | Tx;
