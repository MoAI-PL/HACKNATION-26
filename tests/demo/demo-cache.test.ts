import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { answerFormalQuestion } from "@/lib/ai/funkcje/asystent-formalny";
import { positionFromRecord, proposeAdditionalCriteria, verifyQuote } from "@/lib/ai/funkcje/kryteria-z-osp";
import { LLMError, type LLMProvider } from "@/lib/ai/llm";
import { getFragment, searchKnowledge } from "@/lib/ai/rag/search";
import { cachedCriteria, cachedFormalAnswer, demoCache, normalizeQuestion } from "@/lib/demo/demo-cache";
import { parseOsp } from "@/lib/import/osp";
import { validateAdditionalCriteria } from "@/lib/rules/kryteria";

/** Model, który zawsze zawodzi (np. limit darmowego API na scenie). */
const brokenLLM: LLMProvider = {
  name: "test",
  model: "model-testowy",
  async chat() {
    throw new LLMError("LIMIT_ZAPYTAN", "Przekroczono limit zapytań do modelu.");
  },
};

const osp = (f: string) => parseOsp(readFileSync(`materialy/OSP/${f}.docx`));
const RADCA = osp("OSP_radca_DSI_WWI");
const OSPS = [RADCA, osp("OSP_starszy_specjalista_DC_WZKSOiC"), osp("OSP_naczelnik_DWM_WKAM")];

let demoBefore: string | undefined;
beforeEach(() => {
  demoBefore = process.env.DEMO_MODE;
  process.env.DEMO_MODE = "true";
});
afterEach(() => {
  if (demoBefore === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = demoBefore;
});

describe("plik zapasowych odpowiedzi jest prawdziwy", () => {
  it.each(demoCache.asystentFormalny.map((e) => [e.pytania[0], e] as const))("„%s”: źródła istnieją w bazie wiedzy, pytanie nie trafia w odmowę", (_q, e) => {
    for (const id of e.zrodla) expect(getFragment(id), id).toBeDefined();
    for (const q of e.pytania) expect(searchKnowledge(q).sufficient, q).toBe(true);
  });

  it.each(demoCache.kryteriaZOsp.map((e) => [e.tytul, e] as const))("%s: każdy cytat to dosłowny fragment wskazanego zadania, kryteria zgodne z § 5 ust. 2", (_t, e) => {
    const o = OSPS.find((x) => x.position.symbol === e.symbol)!;
    expect(o.position.title).toBe(e.tytul);
    expect(o.sheet.sheet).toBe(e.arkusz);
    const tasks = [...o.position.dominantTasks, ...o.position.otherTasks].map((text, i) => ({
      number: i + 1,
      text,
      source: i < o.position.dominantTasks.length ? ("ZADANIE_DOMINUJACE" as const) : ("ZADANIE_POZOSTALE" as const),
    }));
    for (const p of e.propozycje) {
      const v = verifyQuote(p.cytat, p.zadanie, tasks);
      expect(v, p.cytat).toMatchObject({ text: p.cytat, taskNumber: p.zadanie });
    }
    expect(validateAdditionalCriteria(e.arkusz, e.propozycje.map((p) => p.kryterium)).valid).toBe(true);
  });
});

describe("dopasowanie pytań i stanowisk", () => {
  it("pytanie bez wielkości liter, polskich znaków i interpunkcji", () => {
    expect(normalizeQuestion("  Ile DNI na sprzeciw?! ")).toBe("ile dni na sprzeciw");
    expect(cachedFormalAnswer("ile dni na sprzeciw")?.odpowiedz).toMatch(/7 dni/);
    expect(cachedFormalAnswer("Jaka jest pogoda?")).toBeUndefined();
  });

  it("stanowisko po symbolu albo – dla OSP z bazy – po nazwie", () => {
    expect(cachedCriteria({ symbol: "DSI WWI 5", title: "radca" }, "C")?.tytul).toBe("radca");
    expect(cachedCriteria({ title: "Naczelnik  Wydziału" }, "B")?.symbol).toBe("DWM WKAM 1");
    expect(cachedCriteria({ title: "radca" }, "B")).toBeUndefined(); // inny arkusz niż w OSP
  });
});

describe("asystent formalny: zapasowa odpowiedź tylko przy błędzie modelu w trybie demo", () => {
  it("model zawodzi, tryb demo → odpowiedź z art. 83 ze źródłami i jawną informacją", async () => {
    const a = await answerFormalQuestion("Ile dni na sprzeciw?", { llm: brokenLLM });
    expect(a).toMatchObject({ refused: false, mode: "AI", fromCache: true });
    expect(a.answer).toMatch(/7 dni od dnia zapoznania się z oceną/);
    expect(a.notice).toMatch(/przygotowana wcześniej dla demo/);
    expect(a.sources.map((s) => s.id)).toEqual(["PORADNIK_OKRESOWE:s32:69", "FAQ:sprzeciw"]);
  });

  it("poza trybem demo – zwykły tryb bez AI (fragmenty przepisów)", async () => {
    process.env.DEMO_MODE = "false";
    const a = await answerFormalQuestion("Ile dni na sprzeciw?", { llm: brokenLLM });
    expect(a.mode).toBe("BEZ_AI");
    expect(a.fromCache).toBeUndefined();
  });

  it("bez skonfigurowanego modelu – tryb bez AI, nie zapas", async () => {
    const a = await answerFormalQuestion("Ile dni na sprzeciw?", { llm: null });
    expect(a.mode).toBe("BEZ_AI");
    expect(a.fromCache).toBeUndefined();
  });

  it("pytanie spoza listy przy błędzie modelu – fragmenty przepisów; spoza zakresu – odmowa", async () => {
    expect((await answerFormalQuestion("Kto podpisuje arkusz oceny?", { llm: brokenLLM })).mode).toBe("BEZ_AI");
    expect((await answerFormalQuestion("Jaka jest pogoda w Krakowie?", { llm: brokenLLM })).refused).toBe(true);
  });
});

describe("analiza OSP: zapasowa propozycja tylko przy błędzie modelu w trybie demo", () => {
  it("plik OSP radcy (z symbolem) → propozycja z cytatami zadań", async () => {
    const r = await proposeAdditionalCriteria(RADCA.position, "C", { llm: brokenLLM });
    expect(r).toMatchObject({ mode: "AI", fromCache: true });
    expect(r.proposals.map((p) => p.competency)).toEqual(["ANALITYCZNE", "KREATYWNOSC", "KLIENT"]);
    expect(r.proposals[0].quote).toMatchObject({ taskNumber: 1, source: "ZADANIE_DOMINUJACE" });
  });

  it("OSP z bazy (kreator Z12, bez symbolu) – dopasowanie po nazwie stanowiska", async () => {
    const p = RADCA.position;
    const fromDb = positionFromRecord({
      title: p.title, purpose: p.purpose, dominantTasks: p.dominantTasks, otherTasks: p.otherTasks,
      subordinates: p.subordinates, authorizations: null, requiredCompetencies: p.requiredCompetencies,
    });
    expect((await proposeAdditionalCriteria(fromDb, "C", { llm: brokenLLM })).fromCache).toBe(true);
  });

  it("poza trybem demo i bez modelu – propozycja bez AI", async () => {
    expect((await proposeAdditionalCriteria(RADCA.position, "C", { llm: null })).mode).toBe("BEZ_AI");
    process.env.DEMO_MODE = "false";
    const r = await proposeAdditionalCriteria(RADCA.position, "C", { llm: brokenLLM });
    expect(r.mode).toBe("BEZ_AI");
    expect(r.fromCache).toBeUndefined();
  });
});

describe("tryb bez AI na gotowej części ścieżki (zasada nr 4)", () => {
  it("bez modelu: asystent formalny odpowiada źródłami, analiza OSP daje propozycję dla każdego OSP od MC", async () => {
    expect((await answerFormalQuestion("Kiedy ocena okresowa jest negatywna?", { llm: null })).sources.length).toBeGreaterThan(0);
    for (const o of OSPS) {
      const r = await proposeAdditionalCriteria(o.position, o.sheet.sheet, { llm: null });
      expect(r.mode).toBe("BEZ_AI");
      expect(r.proposals.length, o.position.title).toBeGreaterThan(0);
    }
  });
});
