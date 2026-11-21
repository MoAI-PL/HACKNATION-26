import { PrismaClient } from "@prisma/client";

// Jeden klient Prisma na proces (w trybie dev Next.js przeładowuje moduły).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
