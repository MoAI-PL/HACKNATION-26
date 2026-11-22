// Podpowiedzi pytań do asystenta formalnego zależne od kroku ścieżki („przełożony nie musi wiedzieć, o co zapytać”).
// Każde pytanie ma odpowiedź w bazie wiedzy – pilnuje tego test tests/ai/asystent-formalny.test.ts.

export const ASSISTANT_STEPS = [
  "START",
  "OSP",
  "KRYTERIA",
  "ROZMOWA_ROZPOCZYNAJACA",
  "OCENA",
  "PODSUMOWANIE",
  "PIERWSZA_OCENA",
] as const;
export type AssistantStep = (typeof ASSISTANT_STEPS)[number];

export const STEP_SUGGESTIONS: Record<AssistantStep, string[]> = {
  START: [
    "Co wydłuża termin oceny okresowej?",
    "Kiedy ocena okresowa jest negatywna?",
    "W jakim terminie można złożyć sprzeciw?",
  ],
  OSP: [
    "Kiedy stosuje się arkusz B, a kiedy arkusz C?",
    "Jakie są kryteria obowiązkowe w arkuszach B i C?",
    "Ile kryteriów dodatkowych można wybrać?",
  ],
  KRYTERIA: [
    "Ile kryteriów dodatkowych można wybrać?",
    "Czy kryterium dodatkowe może powtarzać kryterium obowiązkowe?",
    "Na jakiej podstawie wybiera się kryteria dodatkowe?",
  ],
  ROZMOWA_ROZPOCZYNAJACA: [
    "Co należy omówić na rozmowie rozpoczynającej ocenę?",
    "W jakim terminie przeprowadza się rozmowę o kryteriach?",
    "Czy oceniany podpisuje część I arkusza?",
  ],
  OCENA: [
    "Jaka jest skala punktowa oceny okresowej?",
    "Co omawia się na rozmowie oceniającej?",
    "Czy uzasadnienie oceny jest obowiązkowe?",
  ],
  PODSUMOWANIE: [
    "Kiedy ocena okresowa jest negatywna?",
    "W jakim terminie można złożyć sprzeciw?",
    "Kiedy można złożyć wniosek o kolejny stopień służbowy?",
  ],
  PIERWSZA_OCENA: [
    "Kiedy przeprowadza się rozmowę wstępną przy pierwszej ocenie?",
    "Kiedy egzamin ze służby przygotowawczej nie jest wymagany?",
    "Jakie warunki trzeba spełnić, żeby pierwsza ocena była pozytywna?",
  ],
};

export function suggestionsFor(step: string | null | undefined): string[] {
  return STEP_SUGGESTIONS[(ASSISTANT_STEPS as readonly string[]).includes(step ?? "") ? (step as AssistantStep) : "START"];
}
