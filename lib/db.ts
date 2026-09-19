import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.PRISMA_LOG ? ["query", "warn", "error"] : ["warn", "error"],
  });
}

/**
 * Platform-wide Prisma client. Only platform code (admin, auth, tenant lookup,
 * billing webhooks, workers) should use this directly. Anything that runs on
 * behalf of a lodge must go through `tenantDb(lodgeId)` in ./tenant-db.ts.
 */
export const db: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
