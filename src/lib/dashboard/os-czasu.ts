// Oś czasu procesu pracownika: co już się wydarzyło i jakie terminy prawne są przed nami – na jednej linii z „dziś”.
// Czysta logika bez bazy. Terminy liczy silnik terminów (openDeadlines z pulpitu przełożonego + termin sprzeciwu) – tu je tylko układamy.
// Testy: tests/dashboard/os-czasu.test.ts.

import type { DeadlineKind, DeadlineUrgency, IsoDate } from "@/lib/domain/types";
import { ABSENCE_KIND_LABELS, EVALUATION_TYPE_LABELS, LEVEL_LABELS, RESULT_LABELS } from "@/lib/domain/slownik";
import { DEADLINE_KIND_LABELS, deadlineUrgency, daysUntil, objectionDeadline } from "@/lib/rules/terminy";
import { inclusiveDays } from "@/lib/rules/kalendarz";
import { plural } from "@/lib/rules/tekst";
import { openDeadlines, type EmployeeInfo } from "./pulpit";
import type { HintId } from "@/lib/ui/dlaczego";

export type TimelineKind = "ZDARZENIE" | "OKRES" | "TERMIN" | "DZIS";

/** Zrobione (przeszłość), dziś, przed nami albo termin, który minął. */
export type TimelineState = "ZROBIONE" | "DZIS" | "PRZED_NAMI" | "PO_TERMINIE";

export interface TimelineEntry {
  kind: TimelineKind;
  date: IsoDate;
  /** Koniec okresu (nieobecność) albo termin końcowy przedziału („od … do …”). */
  until?: IsoDate;
  title: string;
  detail?: string;
  legalBasis?: string;
  state: TimelineState;
  /** Tylko terminy: ile dni zostało i jak pilne. */
  daysLeft?: number;
  urgency?: DeadlineUrgency;
  /** Przepisy w kontekście: „ⓘ Dlaczego?” z przepisem i cytatem. */
  hint?: HintId;
}

const DEADLINE_HINTS: Partial<Record<DeadlineKind, HintId>> = {
  ROZMOWA_ROZPOCZYNAJACA: "TERMIN_ROZMOWY_ROZPOCZYNAJACEJ",
  ROZMOWA_PO_NEGATYWNEJ: "TERMIN_ROZMOWY_ROZPOCZYNAJACEJ",
  PONOWNE_KRYTERIA_PO_ZMIANIE_STANOWISKA: "ZMIANA_STANOWISKA",
  SPRZECIW: "SPRZECIW",
};

// Kolejność w tym samym dniu: najpierw to, co się stało, potem znacznik „dziś”, na końcu terminy.
const ORDER: Record<TimelineKind, number> = { OKRES: 0, ZDARZENIE: 1, DZIS: 2, TERMIN: 3 };

const days = (n: number) => `${n} ${plural(n, ["dzień", "dni", "dni"])}`;

/** Oś czasu pracownika: zdarzenia z historii, nieobecności, otwarte terminy przełożonego, termin sprzeciwu i „dziś”. */
export function processTimeline(e: EmployeeInfo, today: IsoDate): TimelineEntry[] {
  const past = (date: IsoDate): TimelineState => (date < today ? "ZROBIONE" : date === today ? "DZIS" : "PRZED_NAMI");
  const out: TimelineEntry[] = [];
  const event = (date: IsoDate, title: string, detail?: string) => out.push({ kind: "ZDARZENIE", date, title, detail, state: past(date) });

  event(e.employmentStart, "Nawiązanie stosunku pracy", e.positionTitle);
  if (e.permanentFrom && e.permanentFrom !== e.employmentStart) event(e.permanentFrom, "Zatrudnienie na czas nieokreślony");

  for (const ev of e.evaluations) {
    const what = ev.isReevaluation ? "ponownej oceny po ocenie negatywnej" : ev.type === "OKRESOWA" ? "oceny okresowej" : "pierwszej oceny";
    if (ev.criteriaSetAt) {
      // Rozmowa rozpoczynająca (ocena okresowa) albo wstępna (pierwsza ocena) – kryteria ustalone.
      const talk = ev.type === "OKRESOWA" ? "Rozmowa rozpoczynająca" : "Rozmowa wstępna";
      event(ev.criteriaSetAt, `${talk} – kryteria ${what}`, ev.type === "OKRESOWA" ? `Arkusz ${ev.sheet}, część I` : EVALUATION_TYPE_LABELS[ev.type]);
    }
    if (ev.reportSubmittedAt) event(ev.reportSubmittedAt, "Złożenie sprawozdania z pierwszego okresu pracy");
    if (ev.evaluatedAt) {
      const outcome = [ev.result && RESULT_LABELS[ev.result], ev.level && LEVEL_LABELS[ev.level]].filter(Boolean).join(" – ");
      event(ev.evaluatedAt, `Sporządzenie ${what}`, outcome ? outcome[0]!.toLocaleUpperCase("pl") + outcome.slice(1) : undefined);
    }
    if (ev.acknowledgedAt) event(ev.acknowledgedAt, "Zapoznanie ocenianego z oceną");
  }

  for (const a of e.absences) {
    const n = inclusiveDays(a.from, a.to);
    out.push({
      kind: "OKRES",
      date: a.from,
      until: a.to,
      title: `Nieobecność: ${ABSENCE_KIND_LABELS[a.kind].toLocaleLowerCase("pl")}`,
      detail: days(n),
      state: a.to < today ? "ZROBIONE" : a.from <= today ? "DZIS" : "PRZED_NAMI",
      hint: "NIEOBECNOSC",
    });
  }

  for (const c of e.positionChanges) {
    event(c.date, "Zmiana stanowiska", c.significantDutiesChange ? "Istotna zmiana obowiązków" : undefined);
    out.at(-1)!.hint = "ZMIANA_STANOWISKA";
  }

  // Terminy przełożonego na bieżącym etapie (silnik terminów) – z wyjaśnieniem i podstawą prawną.
  const deadlines = [...openDeadlines(e)];
  // Termin sprzeciwu ocenianego po ostatnim zapoznaniu – pokazujemy, dopóki nie minął tydzień po nim.
  const lastAck = e.evaluations.filter((ev) => ev.acknowledgedAt).at(-1)?.acknowledgedAt;
  if (lastAck) {
    const objection = objectionDeadline(lastAck);
    if (daysUntil(objection, today) >= -7) deadlines.push(objection);
  }
  for (const d of deadlines) {
    const left = daysUntil(d, today);
    const range = d.earliest && d.earliest !== d.date;
    out.push({
      kind: "TERMIN",
      date: range ? d.earliest! : d.date,
      until: range ? d.date : undefined,
      title: d.kind === "SPRZECIW" ? "Termin na sprzeciw ocenianego" : DEADLINE_KIND_LABELS[d.kind],
      // Wyjaśnienie terminów przełożonego jest w karcie „Terminy” obok – tu tylko termin sprzeciwu, którego tam nie ma.
      detail: d.kind === "SPRZECIW" ? d.explanation.text : undefined,
      legalBasis: d.explanation.legalBasis,
      state: left < 0 ? "PO_TERMINIE" : left === 0 ? "DZIS" : "PRZED_NAMI",
      daysLeft: left,
      urgency: deadlineUrgency(d, today),
      hint: DEADLINE_HINTS[d.kind],
    });
  }

  out.push({ kind: "DZIS", date: today, title: "Dziś", state: "DZIS" });

  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : ORDER[a.kind] - ORDER[b.kind]));
  // Ta sama podpowiedź „Dlaczego?” tylko przy pierwszym wystąpieniu (np. dwie nieobecności).
  const seen = new Set<HintId>();
  for (const x of out) {
    if (!x.hint) continue;
    if (seen.has(x.hint)) x.hint = undefined;
    else seen.add(x.hint);
  }
  return out;
}
