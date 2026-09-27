import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { __questPrisma?: PrismaClient };

function create() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter, log: process.env.PRISMA_LOG === "1" ? ["query", "warn", "error"] : ["warn", "error"] });
}

export const prisma: PrismaClient = globalForPrisma.__questPrisma ?? create();
if (process.env.NODE_ENV !== "production") globalForPrisma.__questPrisma = prisma;

export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
export type Db = PrismaClient | Tx;
