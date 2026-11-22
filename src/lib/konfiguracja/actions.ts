"use server";
// Akcje panelu HR, część 2 (Z19): zmiana parametrów przepisów i opisów zachowań bez zmian w kodzie.
// Każda sprawdza rolę HR (Z04), waliduje zod-em i zapisuje wpis w AuditLog (kto, kiedy, stara i nowa wartość).

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guard";
import { rules } from "@/lib/domain/przepisy";
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
import { RULE_FIELDS, changesForAudit, getPath, rulesFromForm } from "./pola";
import { saveModel, saveRules } from "./repo";
import { LEVEL_KEYS, currentRuntimeConfig, defaultBehavior, defaultRules, type LevelKey, type ModelOverride } from "./stan";

export interface FormState {
  status: "idle" | "ok" | "error";
  message?: string;
  errors?: Record<string, string>;
  /** Wpisane wartości po błędzie – żeby nic nie przepadło. */
  values?: Record<string, string>;
}

const MAX_DESCRIPTION = 600;
const reasonOf = (fd: FormData) => String(fd.get("powod") ?? "").trim().slice(0, 500) || undefined;
const refresh = () => revalidatePath("/", "layout");

/** Zapis parametrów przepisów z formularza. */
export async function saveRulesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireRole("HR");
  const values = Object.fromEntries(RULE_FIELDS.map((f) => [f.path, String(fd.get(f.path) ?? "")]));
  const result = rulesFromForm(structuredClone(rules), values);
  if (!result.ok) return { status: "error", message: result.message, errors: result.errors, values };
  if (result.changes.length === 0) return { status: "ok", message: "Bez zmian – wartości są takie same jak obecne." };

  // Wszystko jak w pliku → usuwamy zmianę zamiast trzymać kopię wartości domyślnych.
  const backToFile = JSON.stringify(result.rules) === JSON.stringify(defaultRules());
  await saveRules(user.id, backToFile ? null : result.rules, { ...changesForAudit(result.changes), reason: reasonOf(fd) });
  refresh();
  const list = result.changes.map((c) => `${c.label}: ${c.old} → ${c.new}`).join("; ");
  return { status: "ok", message: `Zapisano ${result.changes.length === 1 ? "zmianę" : `zmiany (${result.changes.length})`}: ${list}. Obowiązuje od teraz w ocenach i terminach.` };
}

/** „Przywróć wartości z rozporządzenia” – usuwa wszystkie zmiany parametrów. */
export async function resetRulesAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireRole("HR");
  const file = defaultRules();
  const changes = RULE_FIELDS.map((f) => ({ path: f.path, label: f.label, old: Number(getPath(rules, f.path)), new: Number(getPath(file, f.path)) })).filter(
    (c) => c.old !== c.new,
  );
  if (!currentRuntimeConfig().rules) return { status: "ok", message: "Obowiązują już wartości z pliku przepisów." };
  await saveRules(user.id, null, { ...changesForAudit(changes), reason: reasonOf(fd) ?? "Przywrócenie wartości z pliku przepisów" });
  refresh();
  return { status: "ok", message: "Przywrócono wartości z pliku przepisów (data/przepisy.json)." };
}

/** Zapis opisów zachowań jednego wskaźnika. */
export async function saveBehaviorAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireRole("HR");
  const indicatorId = String(fd.get("wskaznik") ?? "");
  const indicator = competencyModel.getIndicator(indicatorId);
  if (!indicator) return { status: "error", message: "Nie ma takiego wskaźnika w modelu kompetencji." };

  const values = Object.fromEntries(LEVEL_KEYS.map((l) => [l, String(fd.get(`poziom-${l}`) ?? "").trim().replace(/\s+/g, " ")]));
  const errors: Record<string, string> = {};
  for (const l of LEVEL_KEYS) {
    if (!values[l]) errors[l] = "Opis zachowania nie może być pusty – karta zachowania musi coś pokazać.";
    else if (values[l]!.length > MAX_DESCRIPTION) errors[l] = `Najwyżej ${MAX_DESCRIPTION} znaków (teraz ${values[l]!.length}).`;
  }
  if (Object.keys(errors).length > 0) return { status: "error", message: "Popraw zaznaczone opisy – nic nie zostało zapisane.", errors, values };

  const changed = LEVEL_KEYS.filter((l) => values[l] !== indicator.levels[Number(l) as 1 | 2 | 3 | 4 | 5]);
  if (changed.length === 0) return { status: "ok", message: "Bez zmian – opisy są takie same jak obecne." };

  const diff = Object.fromEntries(LEVEL_KEYS.filter((l) => values[l] !== defaultBehavior(indicatorId, l)).map((l) => [l, values[l]!]));
  const next: ModelOverride = { ...(currentRuntimeConfig().model ?? {}) };
  if (Object.keys(diff).length > 0) next[indicatorId] = diff;
  else delete next[indicatorId];

  await saveModel(user.id, Object.keys(next).length > 0 ? next : null, {
    indicatorId,
    oldValue: Object.fromEntries(changed.map((l) => [`${indicatorId} poziom ${l}`, indicator.levels[Number(l) as 1 | 2 | 3 | 4 | 5]])),
    newValue: Object.fromEntries(changed.map((l) => [`${indicatorId} poziom ${l}`, values[l]])),
    reason: reasonOf(fd),
  });
  refresh();
  return { status: "ok", message: `Zapisano ${changed.length === 1 ? "opis poziomu" : "opisy poziomów"} ${changed.join(", ")}. Karty zachowań pokazują je od teraz.` };
}

/** „Przywróć opisy z modelu” dla jednego wskaźnika. */
export async function resetBehaviorAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireRole("HR");
  const indicatorId = String(fd.get("wskaznik") ?? "");
  const indicator = competencyModel.getIndicator(indicatorId);
  const override = currentRuntimeConfig().model?.[indicatorId];
  if (!indicator || !override) return { status: "ok", message: "Ten wskaźnik ma już opisy z modelu kompetencji." };
  const levels = Object.keys(override) as LevelKey[];
  const next: ModelOverride = { ...currentRuntimeConfig().model };
  delete next[indicatorId];
  await saveModel(user.id, Object.keys(next).length > 0 ? next : null, {
    indicatorId,
    oldValue: Object.fromEntries(levels.map((l) => [`${indicatorId} poziom ${l}`, override[l]])),
    newValue: Object.fromEntries(levels.map((l) => [`${indicatorId} poziom ${l}`, defaultBehavior(indicatorId, l)])),
    reason: reasonOf(fd) ?? "Przywrócenie opisów z modelu kompetencji",
  });
  refresh();
  return { status: "ok", message: "Przywrócono opisy z modelu kompetencji (data/model-kompetencji.json)." };
}
