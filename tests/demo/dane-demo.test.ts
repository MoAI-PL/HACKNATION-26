// Spójność danych demo (Z26): bez bazy – definicje; z TEST_DATABASE_URL – pełny seed na PostgreSQL.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { DEMO_OBSERVATIONS, DEMO_OSP, seedDemoData } from "@/lib/demo/dane-demo";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/auth/demo";
import { hashPassword } from "@/lib/auth/password";
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
import { rules } from "@/lib/domain/przepisy";
import { fromDbDate } from "@/lib/domain/daty";
import { addDays } from "@/lib/rules/kalendarz";

describe("dane demo – definicje", () => {
  it("stanowiska z OSP dają właściwy arkusz: naczelnik B, radca i starszy specjalista C", () => {
    expect(rules.periodic.sheetBySubordinates[DEMO_OSP.NACZELNIK.subordinates]).toBe("B");
    expect(rules.periodic.sheetBySubordinates[DEMO_OSP.RADCA.subordinates]).toBe("C");
    expect(rules.periodic.sheetBySubordinates[DEMO_OSP.STARSZY_SPECJALISTA.subordinates]).toBe("C");
    for (const o of Object.values(DEMO_OSP)) {
      expect(o.purpose.length).toBeGreaterThan(20);
      expect(o.dominantTasks.length).toBeGreaterThan(0);
    }
  });

  it("każda obserwacja wskazuje istniejący wskaźnik i ma pełny opis SDR", () => {
    for (const list of Object.values(DEMO_OBSERVATIONS)) {
      for (const [ago, indicatorId, level, s, a, r] of list) {
        expect(competencyModel.getIndicator(indicatorId), indicatorId).toBeTruthy();
        expect(level).toBeGreaterThanOrEqual(1);
        expect(level).toBeLessThanOrEqual(5);
        expect(ago).toBeGreaterThanOrEqual(0);
        for (const t of [s, a, r]) expect(t.length).toBeGreaterThan(10);
      }
    }
  });

  it("u Jana większość notatek z ostatnich 30 dni (Lustro: efekt świeżości)", () => {
    const recent = DEMO_OBSERVATIONS.JAN.filter(([ago]) => ago <= rules.mirror.recencyWindowDays).length;
    expect(recent / DEMO_OBSERVATIONS.JAN.length).toBeGreaterThanOrEqual(rules.mirror.recencyMinShare);
  });

  it("u Katarzyny notatki rozłożone na cały okres (brak efektu świeżości)", () => {
    const recent = DEMO_OBSERVATIONS.KATARZYNA.filter(([ago]) => ago <= rules.mirror.recencyWindowDays).length;
    expect(recent / DEMO_OBSERVATIONS.KATARZYNA.length).toBeLessThan(rules.mirror.recencyMinShare);
  });
});

const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("dane demo – seed na PostgreSQL", () => {
  let prisma: PrismaClient;
  const today = "2026-11-21";

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url } } });
    const passwordHash = await hashPassword(DEMO_PASSWORD, 4);
    for (const a of DEMO_ACCOUNTS) {
      await prisma.user.upsert({ where: { email: a.email }, update: { role: a.role }, create: { email: a.email, name: a.name, role: a.role, passwordHash } });
    }
    await seedDemoData(prisma, today);
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("seed jest idempotentny", async () => {
    const before = await prisma.employee.count();
    const summary = await seedDemoData(prisma, today);
    expect(await prisma.employee.count()).toBe(before);
    expect(summary).toMatchObject({ employees: 6, evaluations: 11, observations: 32 });
  });

  it("przełożona ma 6 podwładnych, a konto ocenianego jest powiązane z Janem Nowakiem", async () => {
    const ewa = await prisma.user.findUniqueOrThrow({ where: { email: "ewa.kowalczyk@demo.kompas.test" }, include: { subordinates: true } });
    expect(ewa.subordinates).toHaveLength(6);
    const jan = await prisma.user.findUniqueOrThrow({ where: { email: "jan.nowak@demo.kompas.test" }, include: { employee: true } });
    expect(jan.employee?.lastName).toBe("Nowak");
  });

  it("termin Jana wydłużony o 44 dni L4 i przesunięty z niedzieli na poniedziałek", async () => {
    const ev = await prisma.evaluation.findFirstOrThrow({ where: { employee: { lastName: "Nowak" }, status: "W_OKRESIE_OCENY" } });
    // 24 miesiące od 27.11.2024 = 27.11.2026, + 44 dni = 10.01.2027 (niedziela) → 11.01.2027
    expect(fromDbDate(ev.dueDate!)).toBe("2027-01-11");
  });

  it("Katarzyna ma ocenę za kilka dni z 2 kryteriami dodatkowymi uzasadnionymi cytatem z OSP", async () => {
    const ev = await prisma.evaluation.findFirstOrThrow({ where: { employee: { lastName: "Wójcik" }, status: "W_OCENIE" }, include: { criteria: true } });
    expect(fromDbDate(ev.dueDate!) <= addDays(today, 14)).toBe(true);
    const dodatkowe = ev.criteria.filter((c) => c.kind === "DODATKOWE");
    expect(dodatkowe).toHaveLength(2);
    for (const c of dodatkowe) expect(c.selectionReason).toMatch(/^OSP, zadanie/);
  });

  it("Marcin: poprzednia ocena negatywna, bieżąca ocena jest ponowną oceną", async () => {
    const past = await prisma.evaluation.findFirstOrThrow({ where: { employee: { lastName: "Wróbel" }, status: "ZAKONCZONA" }, orderBy: { evaluatedAt: "desc" } });
    expect(past.result).toBe("NEGATYWNA");
    expect(past.justification).toBeTruthy();
    const cur = await prisma.evaluation.findFirstOrThrow({ where: { employee: { lastName: "Wróbel" }, status: "W_OKRESIE_OCENY" } });
    expect(cur.isReevaluation).toBe(true);
    expect(cur.previousResult).toBe("NEGATYWNA");
  });

  it("dziennik decyzji (Z35) po zasianiu danych nie jest pusty: sporządzenie, zapoznanie, kryteria, propozycje AI, przypomnienie", async () => {
    const actions = new Set((await prisma.auditLog.findMany({ where: { NOT: { action: "LOGOWANIE" } }, select: { action: true } })).map((r) => r.action));
    for (const a of ["SPORZADZENIE_OCENY", "ZAPOZNANIE_Z_OCENA", "USTALENIE_KRYTERIOW", "AI_WSTAW", "PRZYPOMNIENIE_WYSLANE"]) expect(actions).toContain(a);
    const ai = await prisma.auditLog.findFirstOrThrow({ where: { action: "AI_WSTAW", reason: { not: null } } });
    expect(ai.humanDecision).toMatchObject({ decyzja: "WSTAW" });
  });

  it("Lustro ocen (Z36): co najmniej jedna komórka ma 3 sporządzone oceny okresowe, więc rozkład jest widoczny", async () => {
    const rows = await prisma.evaluation.findMany({ where: { type: "OKRESOWA", average: { not: null } }, select: { employee: { select: { orgUnitId: true } } } });
    const perUnit = new Map<string, number>();
    for (const r of rows) perUnit.set(r.employee.orgUnitId ?? "", (perUnit.get(r.employee.orgUnitId ?? "") ?? 0) + 1);
    expect(Math.max(...perUnit.values())).toBeGreaterThanOrEqual(3);
  });

  it("Aleksandra: pierwsza ocena z 5 elementami i kierującym komórką do podpisu", async () => {
    const e = await prisma.employee.findFirstOrThrow({ where: { lastName: "Mazur" }, include: { evaluations: { include: { criteria: true } } } });
    expect(e.unitHeadId).toBeTruthy();
    expect(e.evaluations[0]!.type).toBe("PIERWSZA");
    expect(e.evaluations[0]!.criteria).toHaveLength(5);
  });
});
