// Tryb rozmowy (Z43): kroki ze ściągi, obowiązkowy zakres z przepisu, zapis przebiegu bez dublowania rozmów.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildConversationPrep, type PrepInput } from "@/lib/rozmowa/przygotowanie";
import {
  appendNotes,
  buildConversationSteps,
  conversationSavePlan,
  formatClock,
  formatDuration,
  MAX_CONVERSATION_NOTES_LENGTH,
  missingRequired,
  summarizeConversation,
} from "@/lib/rozmowa/tryb";
import type { ObservationView } from "@/lib/obserwacje/dziennik";

const { authMock, prismaMock, loadPrepDataMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  prismaMock: { conversation: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() } },
  loadPrepDataMock: vi.fn(),
}));
vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/rozmowa/repo", () => ({ loadPrepData: loadPrepDataMock }));

import { saveConversationAction } from "@/lib/rozmowa/tryb-akcje";

function obs(id: string, indicatorId: string, level: 1 | 2 | 3 | 4 | 5, date = "2026-10-01"): ObservationView {
  return {
    id, employeeId: "kasia", employeeName: "Katarzyna Wójcik", date, competency: null, indicatorId, behaviorLevel: level,
    situation: `Sytuacja ${id}`, action: `Działanie ${id}`, outcome: `Rezultat ${id}`, originalText: null, source: "RECZNA",
  };
}

const base: PrepInput = {
  kind: "OCENIAJACA",
  employeeName: "Katarzyna Wójcik",
  positionTitle: "radca",
  dominantTasks: ["Analizuje i dokonuje oceny prawa krajowego.", "Prowadzi sprawy dotyczące opinii indywidualnych."],
  criteria: [
    { competency: "KOMUNIKACJA", kind: "OBOWIAZKOWE" },
    { competency: "WSPOLPRACA", kind: "OBOWIAZKOWE" },
  ],
  ratings: [],
  observations: [obs("b", "KOMUNIKACJA.4", 2, "2026-11-01"), obs("d", "WSPOLPRACA.2", 5)],
  goals: "Zestaw najczęstszych pytań i odpowiedzi.",
  expectations: null,
};

describe("kroki rozmowy ze ściągi (Z24)", () => {
  const prep = buildConversationPrep(base);
  const steps = buildConversationSteps(prep);

  it("otwarcie → zakres z przepisu → informacja zwrotna → pytania → rozwój → zamknięcie", () => {
    const order = steps.map((s) => s.section);
    expect(order[0]).toBe("OTWARCIE");
    expect(order.at(-1)).toBe("ZAMKNIECIE");
    const firstIndex = (sec: string) => order.indexOf(sec as (typeof order)[number]);
    expect(firstIndex("AGENDA")).toBeLessThan(firstIndex("INFORMACJA_ZWROTNA"));
    expect(firstIndex("INFORMACJA_ZWROTNA")).toBeLessThan(firstIndex("PYTANIE"));
    expect(firstIndex("PYTANIE")).toBeLessThan(firstIndex("ROZWOJ"));
    expect(new Set(steps.map((s) => s.id)).size).toBe(steps.length); // identyfikatory unikalne – szkic i odhaczenia
  });

  it("obowiązkowe są dokładnie punkty zakresu rozmowy z § 10 – z podstawą prawną", () => {
    const required = steps.filter((s) => s.required);
    expect(required.map((s) => s.title)).toEqual(prep.agenda.map((a) => a.topic));
    expect(required.every((s) => s.hint === "§ 10 rozporządzenia w sprawie ocen okresowych")).toBe(true);
  });

  it("informacja zwrotna: zachowanie – skutek – oczekiwanie z notatki; każde pytanie to osobny krok", () => {
    const fb = steps.filter((s) => s.section === "INFORMACJA_ZWROTNA");
    expect(fb.length).toBe(prep.feedback.length);
    expect(fb[0]!.lines[0]).toMatch(/^Zachowanie: Działanie/);
    expect(fb[0]!.lines[1]).toMatch(/^Skutek: Rezultat/);
    expect(steps.filter((s) => s.section === "PYTANIE").map((s) => s.title)).toEqual(prep.questions.map((q) => q.text));
  });

  it("zamknięcie rozmowy oceniającej przypomina o sprzeciwie (art. 83)", () => {
    expect(steps.at(-1)!.lines[0]).toMatch(/art\. 83/);
  });

  it("rozmowa wstępna i rozpoczynająca: bez informacji zwrotnej i działań rozwojowych", () => {
    for (const kind of ["WSTEPNA", "ROZPOCZYNAJACA"] as const) {
      const s = buildConversationSteps(buildConversationPrep({ ...base, kind }));
      expect(s.some((x) => x.section === "INFORMACJA_ZWROTNA" || x.section === "ROZWOJ")).toBe(false);
      expect(s.filter((x) => x.required).length).toBe(4);
    }
    const wstepna = buildConversationSteps(buildConversationPrep({ ...base, kind: "WSTEPNA" }));
    expect(wstepna.at(-1)!.lines[0]).toMatch(/sprawozdania/);
  });
});

describe("przebieg rozmowy", () => {
  const steps = buildConversationSteps(buildConversationPrep(base));
  const agenda = steps.filter((s) => s.required);

  it("lista nieomówionych punktów obowiązkowych", () => {
    expect(missingRequired(steps, new Set())).toHaveLength(agenda.length);
    expect(missingRequired(steps, new Set(agenda.map((s) => s.id)))).toEqual([]);
    expect(missingRequired(steps, new Set([agenda[0]!.id])).map((s) => s.id)).toEqual(agenda.slice(1).map((s) => s.id));
  });

  it("zapis: czas, co omówiono, czego nie omówiono i notatki – tylko niepuste", () => {
    const text = summarizeConversation({
      kind: "OCENIAJACA",
      steps,
      done: new Set([agenda[0]!.id, "otwarcie"]),
      notes: { [agenda[0]!.id]: " Raporty po terminie w marcu. ", otwarcie: "   " },
      durationSeconds: 32 * 60 + 10,
    });
    expect(text).toMatch(/^Rozmowa oceniająca w trybie rozmowy, czas: 32 min\./);
    expect(text).toContain(`Omówiono:\n- ${agenda[0]!.title}`);
    expect(text).toContain(`Nie omówiono:\n- ${agenda[1]!.title}\n- ${agenda[2]!.title}`);
    expect(text).toContain(`Notatki:\n- ${agenda[0]!.title}: Raporty po terminie w marcu.`);
    expect(text).not.toContain("Przywitaj"); // otwarcie to nie zakres z przepisu, pusta notatka pominięta
  });

  it("zapis nie przekracza długości pola", () => {
    const long = "x".repeat(MAX_CONVERSATION_NOTES_LENGTH);
    const text = summarizeConversation({ kind: "OCENIAJACA", steps, done: new Set(), notes: { a: long, [agenda[0]!.id]: long }, durationSeconds: 0 });
    expect(text.length).toBeLessThanOrEqual(MAX_CONVERSATION_NOTES_LENGTH);
  });

  it("czas po ludzku i na zegarze", () => {
    expect(formatDuration(45)).toBe("45 s");
    expect(formatDuration(12 * 60 + 20)).toBe("12 min");
    expect(formatDuration(65 * 60)).toBe("1 godz. 5 min");
    expect(formatDuration(120 * 60)).toBe("2 godz.");
    expect(formatClock(247)).toBe("04:07");
    expect(formatClock(3753)).toBe("1:02:33");
  });
});

describe("zapis bez dublowania rozmów", () => {
  const today = "2026-11-22";

  it("rozmowa rozpoczynająca: dopisanie do zapisu z kreatora, bez niego – odesłanie do kreatora", () => {
    expect(conversationSavePlan("ROZPOCZYNAJACA", [], today)).toEqual({ action: "KREATOR" });
    expect(
      conversationSavePlan(
        "ROZPOCZYNAJACA",
        [
          { id: "stara", type: "ROZPOCZYNAJACA", date: "2026-01-10" },
          { id: "nowa", type: "ROZPOCZYNAJACA", date: "2026-02-10" },
        ],
        today,
      ),
    ).toEqual({ action: "APPEND", conversationId: "nowa" });
  });

  it("ta sama rozmowa tego samego dnia – dopisanie; innego dnia albo innego rodzaju – nowy zapis", () => {
    const existing = [
      { id: "r", type: "ROZPOCZYNAJACA", date: today },
      { id: "o", type: "OCENIAJACA", date: "2026-11-20" },
    ];
    expect(conversationSavePlan("OCENIAJACA", existing, today)).toEqual({ action: "CREATE" });
    expect(conversationSavePlan("OCENIAJACA", [...existing, { id: "dzis", type: "OCENIAJACA", date: today }], today)).toEqual({
      action: "APPEND",
      conversationId: "dzis",
    });
    expect(conversationSavePlan("WSTEPNA", existing, today)).toEqual({ action: "KREATOR" });
  });

  it("rozmowa wstępna: dopisanie do zapisu z pierwszej oceny (Z17), bez niego – odesłanie do pierwszej oceny", () => {
    expect(conversationSavePlan("WSTEPNA", [], today)).toEqual({ action: "KREATOR" });
    expect(conversationSavePlan("WSTEPNA", [{ id: "w", type: "WSTEPNA", date: "2026-03-01" }], today)).toEqual({ action: "APPEND", conversationId: "w" });
  });

  it("dopisanie oddziela przebiegi pustą linią i pilnuje długości pola", () => {
    expect(appendNotes(null, " B ")).toBe("B");
    expect(appendNotes("A\n", "B")).toBe("A\n\nB");
    expect(appendNotes("A".repeat(MAX_CONVERSATION_NOTES_LENGTH), "B")).toHaveLength(MAX_CONVERSATION_NOTES_LENGTH);
  });
});

describe("akcja zapisu przebiegu rozmowy", () => {
  const zalogowany = (role: string, id = "ewa") => authMock.mockResolvedValue({ user: { id, role, name: "Ewa" } });
  const prepData = (evaluationId: string | null = "ev1") => ({ evaluationId, allowed: ["ROZPOCZYNAJACA", "OCENIAJACA"], suggested: "OCENIAJACA", input: {} });

  beforeEach(() => {
    authMock.mockReset();
    loadPrepDataMock.mockReset();
    prismaMock.conversation.findMany.mockReset();
    prismaMock.conversation.create.mockReset();
    prismaMock.conversation.update.mockReset();
  });

  it("przełożona: nowa rozmowa oceniająca w bieżącej ocenie, tylko własny podwładny", async () => {
    zalogowany("PRZELOZONY");
    loadPrepDataMock.mockResolvedValue(prepData());
    prismaMock.conversation.findMany.mockResolvedValue([]);
    expect(await saveConversationAction("kasia", { kind: "OCENIAJACA", notes: "Przebieg" })).toEqual({ ok: true, appended: false });
    expect(loadPrepDataMock).toHaveBeenCalledWith("ewa", "kasia");
    expect(prismaMock.conversation.findMany.mock.calls[0][0].where).toEqual({ employeeId: "kasia", evaluationId: "ev1" });
    expect(prismaMock.conversation.create.mock.calls[0][0].data).toMatchObject({ employeeId: "kasia", evaluationId: "ev1", type: "OCENIAJACA", notes: "Przebieg" });
  });

  it("rozmowa rozpoczynająca z zapisem z kreatora – dopisanie notatek, bez nowego zapisu", async () => {
    zalogowany("PRZELOZONY");
    loadPrepDataMock.mockResolvedValue(prepData());
    prismaMock.conversation.findMany.mockResolvedValue([{ id: "c1", type: "ROZPOCZYNAJACA", date: new Date("2026-02-10T00:00:00Z"), notes: "Oczekiwania: X" }]);
    expect(await saveConversationAction("kasia", { kind: "ROZPOCZYNAJACA", notes: "Ustalenia" })).toEqual({ ok: true, appended: true });
    expect(prismaMock.conversation.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { notes: "Oczekiwania: X\n\nUstalenia" } });
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
  });

  it("rozmowa rozpoczynająca bez zapisu z kreatora – odesłanie do kreatora tej oceny", async () => {
    zalogowany("PRZELOZONY");
    loadPrepDataMock.mockResolvedValue(prepData("ev1"));
    prismaMock.conversation.findMany.mockResolvedValue([]);
    const r = await saveConversationAction("kasia", { kind: "ROZPOCZYNAJACA", notes: "Ustalenia" });
    expect(r).toMatchObject({ ok: false, href: "/ocena/okresowa/ev1" });
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
  });

  it("rozmowa wstępna bez zapisu z pierwszej oceny – odesłanie do przebiegu pierwszej oceny", async () => {
    zalogowany("PRZELOZONY");
    loadPrepDataMock.mockResolvedValue({ evaluationId: "p1", allowed: ["WSTEPNA"], suggested: "WSTEPNA", input: {} });
    prismaMock.conversation.findMany.mockResolvedValue([]);
    expect(await saveConversationAction("ola", { kind: "WSTEPNA", notes: "Ustalenia" })).toMatchObject({ ok: false, href: "/ocena/pierwsza/p1" });
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
  });

  it("cudzy pracownik, rodzaj spoza oceny, pusty zapis – bez zapisu", async () => {
    zalogowany("PRZELOZONY");
    loadPrepDataMock.mockResolvedValue(null);
    expect(await saveConversationAction("obcy", { kind: "OCENIAJACA", notes: "x" })).toMatchObject({ ok: false });
    loadPrepDataMock.mockResolvedValue(prepData());
    expect(await saveConversationAction("kasia", { kind: "WSTEPNA", notes: "x" })).toMatchObject({ ok: false, reason: expect.stringMatching(/nie dotyczy/) });
    expect(await saveConversationAction("kasia", { kind: "OCENIAJACA", notes: "   " })).toMatchObject({ ok: false });
    expect(await saveConversationAction("kasia", { kind: "BIEZACA", notes: "x" })).toMatchObject({ ok: false });
    expect(prismaMock.conversation.create).not.toHaveBeenCalled();
    expect(prismaMock.conversation.update).not.toHaveBeenCalled();
  });

  it("inna rola niż przełożony – odmowa", async () => {
    zalogowany("HR");
    await expect(saveConversationAction("kasia", { kind: "OCENIAJACA", notes: "x" })).rejects.toThrow();
    expect(loadPrepDataMock).not.toHaveBeenCalled();
  });
});
