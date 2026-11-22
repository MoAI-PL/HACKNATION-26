// Zmiany przepisów i modelu z panelu HR – odczyt i zapis w bazie (tabela AppInfo) oraz wpis w AuditLog.
// Tylko serwer. Stan w pamięci i walidacja: ./stan.ts.

import type { Prisma } from "@prisma/client";
import type { Rules } from "@/lib/domain/przepisy";
import {
  DEFAULT_CONFIG,
  MODEL_KEY,
  RULES_KEY,
  applyRuntimeConfig,
  loadedConfig,
  parseModelOverride,
  parseRulesOverride,
  type ModelOverride,
  type RuntimeConfig,
} from "./stan";

// Kilka strażników w jednym żądaniu (układ + strona + akcja) nie powinno pytać bazy kilka razy.
const CACHE_MS = 2_000;

async function db() {
  return (await import("@/lib/db")).prisma;
}

/** Zmiany zapisane w bazie. Bez bazy albo przy błędzie – wartości z plików. */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  if (!process.env.DATABASE_URL) return DEFAULT_CONFIG;
  try {
    const prisma = await db();
    const rows = await prisma.appInfo.findMany({ where: { key: { in: [RULES_KEY, MODEL_KEY] } } });
    if (rows.length === 0) return DEFAULT_CONFIG;
    const read = (key: string) => {
      const row = rows.find((r) => r.key === key);
      return row ? JSON.parse(row.value) : null;
    };
    return {
      rules: parseRulesOverride(read(RULES_KEY)),
      model: parseModelOverride(read(MODEL_KEY)),
      stamp: rows.map((r) => `${r.key}@${r.updatedAt.toISOString()}`).sort().join("|"),
    };
  } catch (e) {
    console.error("Nie udało się wczytać zmian przepisów z panelu HR – obowiązują wartości z plików.", e);
    return DEFAULT_CONFIG;
  }
}

/** Wczytuje zmiany z bazy i stosuje je w tym procesie. Wywoływane przez strażników autoryzacji. */
export async function syncRuntimeConfig(force = false): Promise<void> {
  const now = Date.now();
  if (force || now - loadedConfig.checkedAt >= CACHE_MS) {
    loadedConfig.checkedAt = now;
    loadedConfig.config = await loadRuntimeConfig();
  }
  applyRuntimeConfig(loadedConfig.config);
}

type Change = { action: "EDYCJA_PRZEPISOW" | "EDYCJA_MODELU"; oldValue: unknown; newValue: unknown; reason?: string };

async function save(userId: string, key: string, value: unknown | null, change: Change, entityId: string): Promise<void> {
  const prisma = await db();
  await prisma.$transaction(async (tx) => {
    if (value === null) await tx.appInfo.deleteMany({ where: { key } });
    else {
      const json = JSON.stringify(value);
      await tx.appInfo.upsert({ where: { key }, update: { value: json }, create: { key, value: json } });
    }
    await tx.auditLog.create({
      data: {
        userId,
        action: change.action,
        entity: "AppInfo",
        entityId,
        oldValue: change.oldValue as Prisma.InputJsonValue,
        newValue: change.newValue as Prisma.InputJsonValue,
        reason: change.reason,
      },
    });
  });
  await syncRuntimeConfig(true);
}

/** Zapis parametrów przepisów (null = powrót do data/przepisy.json) z wpisem „kto, kiedy, stara i nowa wartość”. */
export async function saveRules(userId: string, next: Rules | null, change: Omit<Change, "action">): Promise<void> {
  await save(userId, RULES_KEY, next, { action: "EDYCJA_PRZEPISOW", ...change }, "przepisy");
}

/** Zapis opisów zachowań (null = powrót do data/model-kompetencji.json). */
export async function saveModel(userId: string, next: ModelOverride | null, change: Omit<Change, "action"> & { indicatorId: string }): Promise<void> {
  const { indicatorId, ...rest } = change;
  await save(userId, MODEL_KEY, next, { action: "EDYCJA_MODELU", ...rest }, indicatorId);
}

/** Ostatnie zmiany z panelu HR (do listy „Historia zmian”). */
export async function recentChanges(limit = 10) {
  const prisma = await db();
  return prisma.auditLog.findMany({
    where: { action: { in: ["EDYCJA_PRZEPISOW", "EDYCJA_MODELU"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, email: true } } },
  });
}
