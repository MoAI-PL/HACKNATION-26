// Reset danych demo: przywraca stan początkowy jednym kliknięciem z panelu HR.
// Konta demo zostają (sesje się nie urywają), a pracownicy, oceny, obserwacje i przypomnienia powstają od nowa
// z datami liczonymi od dzisiaj – tak samo jak przy wdrożeniu.

import type { PrismaClient } from "@prisma/client";
import { isDemoMode } from "@/lib/auth/demo";
import { seedDemoData, type DemoSummary } from "./dane-demo";

export class DemoResetDisabledError extends Error {
  constructor() {
    super("Reset danych demo działa tylko w trybie demo (DEMO_MODE=true). Na produkcji jest wyłączony.");
    this.name = "DemoResetDisabledError";
  }
}

export interface DemoResetResult extends DemoSummary {
  durationMs: number;
}

export async function resetDemoData(prisma: PrismaClient, userId: string, env: Record<string, string | undefined> = process.env): Promise<DemoResetResult> {
  if (!isDemoMode(env.DEMO_MODE)) throw new DemoResetDisabledError();
  const started = Date.now();
  const summary = await seedDemoData(prisma); // usuwa poprzednie dane demo i tworzy je od nowa
  const durationMs = Date.now() - started;
  // Wpis po resecie – reset czyści dziennik zdarzeń z danymi demo.
  await prisma.auditLog.create({
    data: { userId, action: "RESET_DEMO", entity: "AppInfo", entityId: "dane-demo", newValue: { ...summary, durationMs } },
  });
  return { ...summary, durationMs };
}
