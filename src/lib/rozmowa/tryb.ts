// Tryb rozmowy (Z43): ściąga z Z24 jako kroki do przejścia w trakcie rozmowy – czysta logika bez bazy i bez AI.
//
// Kroki: otwarcie → punkty zakresu rozmowy z przepisu (agenda) → informacja zwrotna → pytania → działania rozwojowe → zamknięcie.
// Punkty zakresu z przepisu (§ 3 rozp. o pierwszej ocenie, § 5 ust. 1 i § 10 rozp. o ocenach okresowych) są obowiązkowe:
// przed zapisem przebiegu przełożony widzi, czego nie omówił. Pozostałe kroki to podpowiedzi – można je pominąć.

import { CONVERSATION_LABELS, type ConversationKind, type ConversationPrep } from "./przygotowanie";

export type StepSection = "OTWARCIE" | "AGENDA" | "INFORMACJA_ZWROTNA" | "PYTANIE" | "ROZWOJ" | "ZAMKNIECIE";

export const SECTION_LABELS: Record<StepSection, string> = {
  OTWARCIE: "Otwarcie",
  AGENDA: "Zakres rozmowy",
  INFORMACJA_ZWROTNA: "Informacja zwrotna",
  PYTANIE: "Pytanie",
  ROZWOJ: "Rozwój",
  ZAMKNIECIE: "Zamknięcie",
};

export interface ConversationStep {
  id: string;
  section: StepSection;
  title: string;
  /** Szczegóły pod tytułem (np. zadania z OSP, zachowanie – skutek – oczekiwanie). */
  lines: string[];
  /** Skąd się wziął krok, np. „§ 10 pkt 3 – kierunki rozwoju” albo „notatka z 19 lutego”. */
  hint?: string;
  /** Punkt zakresu rozmowy wymagany przepisem. */
  required: boolean;
}

/** Najdłuższa notatka do jednego kroku i cały zapis przebiegu (pole `Conversation.notes`). */
export const MAX_STEP_NOTE_LENGTH = 1000;
export const MAX_CONVERSATION_NOTES_LENGTH = 10_000;

export function buildConversationSteps(prep: ConversationPrep): ConversationStep[] {
  const steps: ConversationStep[] = [];
  steps.push({
    id: "otwarcie",
    section: "OTWARCIE",
    title: "Przywitaj się i powiedz, po co jest ta rozmowa",
    lines: [prep.goal, "Powiedz, ile potrwa rozmowa i że będziesz robić notatki."],
    hint: `Zakres rozmowy: ${prep.legalBasis}`,
    required: false,
  });
  prep.agenda.forEach((a, i) =>
    steps.push({ id: `agenda-${i + 1}`, section: "AGENDA", title: a.topic, lines: a.details, hint: prep.legalBasis, required: true }),
  );
  prep.feedback.forEach((f, i) =>
    steps.push({
      id: `informacja-${i + 1}`,
      section: "INFORMACJA_ZWROTNA",
      title: f.indicatorName,
      lines: [`Zachowanie: ${f.behavior}`, `Skutek: ${f.effect}`, f.expectation],
      hint: "zachowanie – skutek – oczekiwanie, na podstawie notatki z dziennika",
      required: false,
    }),
  );
  prep.questions.forEach((q, i) =>
    steps.push({ id: `pytanie-${i + 1}`, section: "PYTANIE", title: q.text, lines: [], hint: q.why, required: false }),
  );
  if (prep.development.length > 0) {
    steps.push({
      id: "rozwoj",
      section: "ROZWOJ",
      title: "Uzgodnij działania rozwojowe",
      lines: prep.development.map((d) => `${d.name}: ${d.ideas.slice(0, 2).join("; ")}`),
      hint: "uzgodnione działania wpiszesz do wniosków IPRZ w podsumowaniu oceny",
      required: false,
    });
  }
  steps.push({
    id: "zamkniecie",
    section: "ZAMKNIECIE",
    title: "Podsumuj ustalenia i zapytaj, czy oceniany ma pytania",
    lines: [closingLine(prep.kind)],
    required: false,
  });
  return steps;
}

function closingLine(kind: ConversationKind): string {
  if (kind === "WSTEPNA") return "Powtórz termin złożenia sprawozdania i zapisz go w notatce z rozmowy.";
  if (kind === "ROZPOCZYNAJACA") return "Powtórz kryteria, oczekiwania i cele – zapiszesz je w kreatorze oceny okresowej.";
  return "Powiedz, kiedy sporządzisz ocenę na piśmie i że od oceny przysługuje sprzeciw (art. 83 ustawy o służbie cywilnej).";
}

/** Obowiązkowe punkty zakresu rozmowy, których przełożony nie odhaczył. */
export function missingRequired(steps: ConversationStep[], done: ReadonlySet<string>): ConversationStep[] {
  return steps.filter((s) => s.required && !done.has(s.id));
}

/** Czas rozmowy dla człowieka: „45 s”, „12 min”, „1 godz. 5 min”. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} godz.${min % 60 ? ` ${min % 60} min` : ""}`;
}

/** Zegar na ekranie: „04:07”, „1:02:33”. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}

export interface ConversationRun {
  kind: ConversationKind;
  steps: ConversationStep[];
  done: ReadonlySet<string>;
  /** Notatki do kroków (id kroku → tekst). */
  notes: Readonly<Record<string, string>>;
  durationSeconds: number;
}

/**
 * Zapis przebiegu rozmowy (pole `Conversation.notes`): co omówiono, czego nie omówiono z zakresu z przepisu i notatki.
 * Tekst, nie JSON – czyta go człowiek (karta pracownika, eksport), a przełożony może go poprawić przed zapisem.
 */
export function summarizeConversation(run: ConversationRun): string {
  const lines: string[] = [`${CONVERSATION_LABELS[run.kind]} w trybie rozmowy, czas: ${formatDuration(run.durationSeconds)}.`];
  const agenda = run.steps.filter((s) => s.section === "AGENDA");
  const discussed = agenda.filter((s) => run.done.has(s.id));
  const missing = missingRequired(run.steps, run.done);
  if (discussed.length) lines.push("", "Omówiono:", ...discussed.map((s) => `- ${s.title}`));
  if (missing.length) lines.push("", "Nie omówiono:", ...missing.map((s) => `- ${s.title}`));
  const notes = run.steps
    .map((s) => ({ s, note: (run.notes[s.id] ?? "").trim() }))
    .filter((x) => x.note);
  if (notes.length) lines.push("", "Notatki:", ...notes.map(({ s, note }) => `- ${s.title}: ${note}`));
  return lines.join("\n").slice(0, MAX_CONVERSATION_NOTES_LENGTH);
}

export type SavePlan = { action: "CREATE" } | { action: "APPEND"; conversationId: string } | { action: "KREATOR" };

/**
 * Jak zapisać przebieg rozmowy, żeby nie dublować zapisów:
 *  - rozmowę rozpoczynającą zapisuje kreator oceny okresowej (Z12) razem z kryteriami, a rozmowę wstępną – przebieg
 *    pierwszej oceny (Z17) razem z terminem sprawozdania; tryb rozmowy tylko dopisuje notatki do istniejącego zapisu,
 *    a bez niego odsyła do właściwego formularza;
 *  - ten sam rodzaj rozmowy w tej samej ocenie tego samego dnia (np. dokończona po przerwie) – dopisujemy do zapisu;
 *  - w pozostałych przypadkach – nowy zapis.
 */
export function conversationSavePlan(
  kind: ConversationKind,
  existing: { id: string; type: string; date: string }[],
  today: string,
): SavePlan {
  const sameType = existing.filter((c) => c.type === kind);
  if (kind === "ROZPOCZYNAJACA" || kind === "WSTEPNA") {
    const latest = [...sameType].sort((a, b) => b.date.localeCompare(a.date))[0];
    return latest ? { action: "APPEND", conversationId: latest.id } : { action: "KREATOR" };
  }
  const sameDay = sameType.find((c) => c.date === today);
  return sameDay ? { action: "APPEND", conversationId: sameDay.id } : { action: "CREATE" };
}

/** Dopisanie kolejnego przebiegu do istniejących notatek (z przycięciem do długości pola). */
export function appendNotes(previous: string | null, next: string): string {
  const joined = previous?.trim() ? `${previous.trim()}\n\n${next.trim()}` : next.trim();
  return joined.slice(0, MAX_CONVERSATION_NOTES_LENGTH);
}
