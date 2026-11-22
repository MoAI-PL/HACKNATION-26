// Panel HR, część 2 (Z19): zmiana parametrów przepisów i opisów zachowań bez zmian w kodzie.
// Kryterium akceptacji: zmiana progu lub opisu wskaźnika od razu działa w ocenie. Każda zmiana = wpis w AuditLog.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, store, prismaMock } = vi.hoisted(() => {
  const store = new Map<string, { key: string; value: string; updatedAt: Date }>();
  let tick = 0;
  const prismaMock = {
    appInfo: {
      findMany: vi.fn(async ({ where }: { where: { key: { in: string[] } } }) => [...store.values()].filter((r) => where.key.in.includes(r.key))),
      upsert: vi.fn(async ({ where, create }: { where: { key: string }; create: { key: string; value: string } }) => {
        const row = { key: where.key, value: create.value, updatedAt: new Date(Date.UTC(2026, 10, 22, 1, 0, tick++)) };
        store.set(where.key, row);
        return row;
      }),
      deleteMany: vi.fn(async ({ where }: { where: { key: string } }) => {
        store.delete(where.key);
        return { count: 1 };
      }),
    },
    auditLog: { create: vi.fn(), findMany: vi.fn(async () => []) },
    $transaction: vi.fn(),
  };
  prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock));
  return { authMock: vi.fn(), store, prismaMock };
});
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { rules } from "@/lib/domain/przepisy";
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
import { objectionDeadline } from "@/lib/rules/terminy";
import { validateAdditionalCriteria } from "@/lib/rules/kryteria";
import { DEFAULT_CONFIG, applyRuntimeConfig, currentRuntimeConfig, defaultRules, parseModelOverride, parseRulesOverride, resetRuntimeConfig } from "@/lib/konfiguracja/stan";
import { RULE_FIELDS, basisOf, describeChange, displayValue, getPath, rulesFromForm } from "@/lib/konfiguracja/pola";
import { resetBehaviorAction, resetRulesAction, saveBehaviorAction, saveRulesAction, type FormState } from "@/lib/konfiguracja/actions";

const IDLE: FormState = { status: "idle" };
const formValues = (over: Record<string, string> = {}) =>
  Object.fromEntries(RULE_FIELDS.map((f) => [f.path, over[f.path] ?? String(displayValue(f, rules))]));
const toFormData = (values: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
};
const zalogowany = (role: string) => authMock.mockResolvedValue({ user: { id: `u-${role}`, role, name: "Test" } });

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://test");
  store.clear();
  prismaMock.auditLog.create.mockReset();
  resetRuntimeConfig();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetRuntimeConfig();
});

describe("stan w pamięci: zmiana działa od razu w silnikach", () => {
  it("termin sprzeciwu 7 → 14 dni: silnik terminów liczy nowy termin; powrót do pliku przywraca 7 dni", () => {
    expect(objectionDeadline("2026-11-02").date).toBe("2026-11-09");
    const next = defaultRules();
    next.periodicDeadlines.objectionDays = 14;
    applyRuntimeConfig({ rules: next, model: null, stamp: "t1" });
    expect(objectionDeadline("2026-11-02").date).toBe("2026-11-16");
    expect(objectionDeadline("2026-11-02").explanation.text).toMatch(/14 dni/);
    applyRuntimeConfig(DEFAULT_CONFIG);
    expect(objectionDeadline("2026-11-02").date).toBe("2026-11-09");
  });

  it("limit kryteriów dodatkowych 3 → 2: walidacja wyboru w kreatorze od razu go stosuje", () => {
    const pick = ["ANALITYCZNE", "KLIENT", "NEGOCJOWANIE"];
    expect(validateAdditionalCriteria("C", pick).valid).toBe(true);
    const next = defaultRules();
    next.periodic.maxAdditionalCriteria = 2;
    applyRuntimeConfig({ rules: next, model: null, stamp: "t2" });
    const v = validateAdditionalCriteria("C", pick);
    expect(v.valid).toBe(false);
    expect(v.errors[0]!.text).toMatch(/najwyżej 2/);
  });

  it("opis zachowania: karta zachowania pokazuje nowy opis, pozostałe poziomy bez zmian; powrót przywraca oryginał", () => {
    const original = competencyModel.behaviorDescription("KOMUNIKACJA.2", 3)!;
    const level4 = competencyModel.behaviorDescription("KOMUNIKACJA.2", 4);
    applyRuntimeConfig({ rules: null, model: { "KOMUNIKACJA.2": { "3": "Nowy opis poziomu 3." } }, stamp: "t3" });
    expect(competencyModel.behaviorDescription("KOMUNIKACJA.2", 3)).toBe("Nowy opis poziomu 3.");
    expect(competencyModel.getIndicator("KOMUNIKACJA.2")!.levels[3]).toBe("Nowy opis poziomu 3.");
    expect(competencyModel.behaviorDescription("KOMUNIKACJA.2", 4)).toBe(level4);
    applyRuntimeConfig(DEFAULT_CONFIG);
    expect(competencyModel.behaviorDescription("KOMUNIKACJA.2", 3)).toBe(original);
  });

  it("odczyt z bazy: niepoprawne parametry → wartości z pliku; nieznany wskaźnik i opis jak w pliku są pomijane", () => {
    const broken = defaultRules() as unknown as { periodicDeadlines: { objectionDays: number } };
    broken.periodicDeadlines.objectionDays = -3;
    expect(parseRulesOverride(broken)).toBeNull();
    expect(parseRulesOverride(defaultRules())).toEqual(defaultRules());
    const same = competencyModel.behaviorDescription("WIEDZA.1", 1)!;
    expect(parseModelOverride({ "WIEDZA.1": { "1": same }, "NIEMA.1": { "1": "x" } })).toBeNull();
    expect(parseModelOverride({ "WIEDZA.1": { "2": "Inny opis" } })).toEqual({ "WIEDZA.1": { "2": "Inny opis" } });
    expect(parseModelOverride({ "WIEDZA.1": { "2": "   " } })).toBeNull();
  });
});

describe("formularz parametrów", () => {
  it("każde pole wskazuje liczbę w data/przepisy.json i ma podstawę albo opis założenia", () => {
    for (const f of RULE_FIELDS) {
      expect(typeof getPath(rules, f.path), f.path).toBe("number");
      expect(basisOf(f, rules), f.path).toBeTruthy();
      const v = displayValue(f, rules);
      expect(v >= f.min && v <= f.max, `${f.path}=${v} poza zakresem pola`).toBe(true);
    }
  });

  it("bez zmian → pusta lista zmian; procenty: 75% → 0,75", () => {
    expect(rulesFromForm(rules, formValues())).toMatchObject({ ok: true, changes: [] });
    const r = rulesFromForm(rules, formValues({ "mirror.recencyMinShare": "75" }));
    expect(r.ok && r.rules.mirror.recencyMinShare).toBe(0.75);
    expect(r.ok && r.changes).toEqual([{ path: "mirror.recencyMinShare", label: expect.any(String), old: 0.6, new: 0.75 }]);
  });

  it("błędy przy polach: poza zakresem, ułamek dni, puste pole, „wkrótce” ≤ „pilny”", () => {
    const r = rulesFromForm(
      rules,
      formValues({ "periodicDeadlines.objectionDays": "0", "periodicDeadlines.criteriaConversationDays": "30,5", "firstEval.initialConversationDays": "", "deadlineUrgency.soonDays": "5" }),
    );
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors["periodicDeadlines.objectionDays"]).toBe("Dozwolona wartość: od 1 do 365 dni.");
    expect(r.errors["periodicDeadlines.criteriaConversationDays"]).toBe("Wpisz liczbę całkowitą.");
    expect(r.errors["firstEval.initialConversationDays"]).toMatch(/Wpisz liczbę/);
    expect(r.errors["deadlineUrgency.soonDays"]).toMatch(/większy niż próg „pilny” \(7 dni\)/);
  });

  it("opis zmiany do historii: etykieta i jednostka, procenty", () => {
    expect(describeChange("EDYCJA_PRZEPISOW", { "periodicDeadlines.objectionDays": 7, "mirror.recencyMinShare": 0.6 }, { "periodicDeadlines.objectionDays": 14, "mirror.recencyMinShare": 0.75 })).toEqual([
      "Sprzeciw od oceny – od zapoznania się z oceną: 7 dni → 14 dni",
      "Lustro – sygnał, gdy świeże notatki to co najmniej: 60% → 75%",
    ]);
  });
});

describe("akcje panelu HR", () => {
  it("HR zapisuje termin sprzeciwu: wiersz w AppInfo, wpis w dzienniku (kto, stara i nowa wartość, powód), silnik liczy od razu", async () => {
    zalogowany("HR");
    const fd = toFormData({ ...formValues({ "periodicDeadlines.objectionDays": "14" }), powod: "Nowelizacja ustawy" });
    const s = await saveRulesAction(IDLE, fd);
    expect(s.status).toBe("ok");
    expect(s.message).toMatch(/7 → 14/);
    expect(prismaMock.auditLog.create.mock.calls[0][0].data).toMatchObject({
      userId: "u-HR",
      action: "EDYCJA_PRZEPISOW",
      oldValue: { "periodicDeadlines.objectionDays": 7 },
      newValue: { "periodicDeadlines.objectionDays": 14 },
      reason: "Nowelizacja ustawy",
    });
    expect(store.size).toBe(1);
    expect(rules.periodicDeadlines.objectionDays).toBe(14);
    expect(objectionDeadline("2026-11-02").date).toBe("2026-11-16");

    // Przywrócenie: wiersz znika, wpis w dzienniku, znów 7 dni.
    const back = await resetRulesAction(IDLE, new FormData());
    expect(back.status).toBe("ok");
    expect(store.size).toBe(0);
    expect(prismaMock.auditLog.create.mock.calls[1][0].data).toMatchObject({ newValue: { "periodicDeadlines.objectionDays": 7 } });
    expect(rules.periodicDeadlines.objectionDays).toBe(7);
  });

  it("błąd walidacji: nic nie trafia do bazy, wpisane wartości wracają do formularza", async () => {
    zalogowany("HR");
    const s = await saveRulesAction(IDLE, toFormData(formValues({ "periodicDeadlines.objectionDays": "999" })));
    expect(s).toMatchObject({ status: "error", errors: { "periodicDeadlines.objectionDays": expect.any(String) } });
    expect(s.values?.["periodicDeadlines.objectionDays"]).toBe("999");
    expect(store.size).toBe(0);
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled();
  });

  it("opis zachowania: zapis różnicy względem modelu, wpis w dzienniku; powrót do opisu z modelu usuwa zmianę", async () => {
    zalogowany("HR");
    const ind = competencyModel.getIndicator("WSPOLPRACA.1")!;
    const original = { ...ind.levels };
    const fd = new FormData();
    fd.set("wskaznik", "WSPOLPRACA.1");
    for (const l of [1, 2, 3, 4, 5] as const) fd.set(`poziom-${l}`, l === 2 ? "  Dzieli się informacjami   dopiero na prośbę. " : original[l]);
    const s = await saveBehaviorAction(IDLE, fd);
    expect(s.status).toBe("ok");
    expect(competencyModel.behaviorDescription("WSPOLPRACA.1", 2)).toBe("Dzieli się informacjami dopiero na prośbę.");
    expect(currentRuntimeConfig().model).toEqual({ "WSPOLPRACA.1": { "2": "Dzieli się informacjami dopiero na prośbę." } });
    expect(prismaMock.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: "EDYCJA_MODELU",
      entityId: "WSPOLPRACA.1",
      oldValue: { "WSPOLPRACA.1 poziom 2": original[2] },
      newValue: { "WSPOLPRACA.1 poziom 2": "Dzieli się informacjami dopiero na prośbę." },
    });

    const reset = new FormData();
    reset.set("wskaznik", "WSPOLPRACA.1");
    await resetBehaviorAction(IDLE, reset);
    expect(competencyModel.behaviorDescription("WSPOLPRACA.1", 2)).toBe(original[2]);
    expect(store.size).toBe(0);
  });

  it("pusty opis – błąd przy poziomie, bez zapisu", async () => {
    zalogowany("HR");
    const fd = new FormData();
    fd.set("wskaznik", "WSPOLPRACA.1");
    for (const l of [1, 2, 3, 4, 5]) fd.set(`poziom-${l}`, l === 5 ? " " : "opis");
    const s = await saveBehaviorAction(IDLE, fd);
    expect(s).toMatchObject({ status: "error", errors: { "5": expect.stringMatching(/nie może być pusty/) } });
    expect(store.size).toBe(0);
  });

  it.each(["PRZELOZONY", "OCENIANY", "KIERUJACY_KOMORKA"])("rola %s – 403, przepisy nietknięte", async (role) => {
    zalogowany(role);
    await expect(saveRulesAction(IDLE, toFormData(formValues({ "periodicDeadlines.objectionDays": "1" })))).rejects.toMatchObject({ status: 403 });
    await expect(saveBehaviorAction(IDLE, new FormData())).rejects.toMatchObject({ status: 403 });
    expect(store.size).toBe(0);
    expect(rules.periodicDeadlines.objectionDays).toBe(7);
  });

  it("strażnik autoryzacji wczytuje zmiany zapisane w bazie przez inny proces (np. inną instancję serwera)", async () => {
    const next = defaultRules();
    next.periodicDeadlines.objectionDays = 10;
    store.set("panel-hr:przepisy", { key: "panel-hr:przepisy", value: JSON.stringify(next), updatedAt: new Date() });
    const { syncRuntimeConfig } = await import("@/lib/konfiguracja/repo");
    await syncRuntimeConfig(true);
    expect(rules.periodicDeadlines.objectionDays).toBe(10);
  });
});
