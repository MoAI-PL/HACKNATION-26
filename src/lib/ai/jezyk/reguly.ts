// Asystent języka – reguły bez AI. Działają w przeglądarce, od razu po przerwie w pisaniu.
// Wykrywają w uzasadnieniu, IPRZ i wnioskach opis OSOBY zamiast opisu ZACHOWANIA:
//  - oceny charakteru („jest leniwy”, „niekomunikatywna”, „ma trudny charakter”),
//  - etykiety („bałaganiarz”, „typ samotnika”),
//  - uogólnienia („zawsze się spóźnia”, „nigdy nie oddaje na czas”).
// Ocena w służbie cywilnej ma opierać się na zachowaniach i ich skutkach (model kompetencji, wskaźniki behawioralne).

export type LanguageIssueKind = "OCENA_OSOBY" | "ETYKIETA" | "UOGOLNIENIE";

export interface LanguageIssue {
  kind: LanguageIssueKind;
  /** Fragment tekstu w oryginalnej pisowni, np. „jest leniwy”. */
  phrase: string;
  start: number;
  end: number;
  /** Krótka podpowiedź: co napisać zamiast tego. */
  hint: string;
}

/** Małe litery, bez polskich znaków (ł → l), z zachowaniem długości tekstu – pozycje pasują do oryginału. */
export function foldText(text: string): string {
  return text
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
}

// ZAŁOŻENIE: rdzenie przymiotników i rzeczowników oceniających osobę (po foldText). Lista celowo zachowawcza –
// lepiej przepuścić rzadkie sformułowanie niż oznaczać zdania o zachowaniu. Pełniejsze rozpoznanie daje model.
const TRAITS: { stem: string; hint: string }[] = [
  { stem: "leniw", hint: "np. „w III kwartale dwukrotnie przekazał zadanie po terminie bez informacji o opóźnieniu”" },
  { stem: "niekompetent", hint: "np. „w 3 z 5 projektów pism pominął wymagane podstawy prawne”" },
  { stem: "nieodpowiedzialn", hint: "np. „nie poinformował zespołu, że nie przygotuje materiału na posiedzenie”" },
  { stem: "niekomunikatywn", hint: "np. „nie przekazał zespołowi ustaleń ze spotkania z DSI”" },
  { stem: "roszczeniow", hint: "np. „trzykrotnie odmówił przyjęcia zadania z zakresu swoich obowiązków”" },
  { stem: "konfliktow", hint: "np. „na naradzie przerywał innym i podnosił głos”" },
  { stem: "arogan", hint: "np. „odpowiedział interesantowi, że to nie jego sprawa”" },
  { stem: "chaotyczn", hint: "np. „przekazał raport bez tabel i z niepełnymi danymi”" },
  { stem: "nieogarniet", hint: "np. „pominął 2 z 5 terminów w harmonogramie”" },
  { stem: "niesumienn", hint: "np. „nie sprawdził danych przed wysłaniem zestawienia”" },
  { stem: "nierzeteln", hint: "np. „w zestawieniu za maj były błędy w 4 pozycjach”" },
  { stem: "opiesz", hint: "np. „odpowiedzi na pisma przygotowywał średnio 5 dni po terminie”" },
  { stem: "niezaangazowan", hint: "np. „nie zgłosił się do żadnego z trzech zadań dodatkowych”" },
  { stem: "malo zaangazowan", hint: "np. „nie zgłosił się do żadnego z trzech zadań dodatkowych”" },
  { stem: "biern", hint: "np. „podczas spotkań projektowych nie zgłaszał uwag ani propozycji”" },
  { stem: "niesamodzieln", hint: "np. „przy każdym piśmie prosił o weryfikację, także w sprawach powtarzalnych”" },
  { stem: "wybuchow", hint: "np. „podczas rozmowy z interesantem podniósł głos”" },
  { stem: "uparc", hint: "np. „nie uwzględnił uwag zespołu do projektu, mimo trzech próśb”" },
  { stem: "upart", hint: "np. „nie uwzględnił uwag zespołu do projektu, mimo trzech próśb”" },
  { stem: "niekulturaln", hint: "np. „przerwał wypowiedź współpracownika na naradzie”" },
  { stem: "niemil", hint: "np. „odpowiedział interesantowi podniesionym głosem”" },
  { stem: "niepunktualn", hint: "np. „w październiku 6 razy rozpoczął pracę po 8:15”" },
  { stem: "niedokladn", hint: "np. „w raporcie pominął dane z dwóch wydziałów”" },
  // Także pochwały – ocena ma opisywać zachowanie, nie cechy osoby.
  { stem: "pracowit", hint: "np. „przejął dodatkowo obsługę dwóch spraw, gdy zespół był w niepełnym składzie”" },
  { stem: "inteligent", hint: "np. „zaproponował rozwiązanie, które skróciło procedurę o tydzień”" },
  { stem: "sympatyczn", hint: "np. „pomaga nowym osobom w zespole we wdrożeniu”" },
  { stem: "bystr", hint: "np. „wychwycił błąd w projekcie umowy przed podpisaniem”" },
];

const LABELS: { stem: string; hint: string }[] = [
  { stem: "balaganiar", hint: "opisz konkretne skutki, np. „dokumenty sprawy nie były uporządkowane w EZD”" },
  { stem: "leser", hint: "opisz konkretne zadania i terminy, których nie dotrzymał" },
  { stem: "len ", hint: "opisz konkretne zadania i terminy, których nie dotrzymał" },
  { stem: "typ samotnika", hint: "opisz, w jakich sytuacjach nie współpracował z zespołem i jaki był skutek" },
  { stem: "trudny charakter", hint: "opisz konkretne zachowanie w konkretnej sytuacji" },
  { stem: "trudna osoba", hint: "opisz konkretne zachowanie w konkretnej sytuacji" },
  { stem: "nie nadaje sie", hint: "opisz, których wymagań stanowiska nie spełniał i na podstawie jakich zdarzeń" },
  { stem: "ma problem z", hint: "zamiast „ma problem z…” opisz sytuację: kiedy, co zrobił, jaki był skutek" },
  { stem: "ma problemy z", hint: "zamiast „ma problemy z…” opisz sytuację: kiedy, co zrobił, jaki był skutek" },
  { stem: "brak mu", hint: "zamiast tego, czego „brak”, opisz konkretne zachowanie i jego skutek" },
  { stem: "brakuje mu", hint: "zamiast tego, czego „brakuje”, opisz konkretne zachowanie i jego skutek" },
  { stem: "brakuje jej", hint: "zamiast tego, czego „brakuje”, opisz konkretne zachowanie i jego skutek" },
];

const GENERALIZATIONS: { stem: string; hint: string }[] = [
  { stem: "zawsze", hint: "podaj, ile razy i kiedy – np. „w 4 z 6 spraw w III kwartale”" },
  { stem: "nigdy", hint: "podaj konkretny okres i przykłady – np. „w październiku i listopadzie nie…”" },
  { stem: "ciagle", hint: "podaj, ile razy i kiedy" },
  { stem: "notorycznie", hint: "podaj, ile razy i kiedy" },
  { stem: "wiecznie", hint: "podaj, ile razy i kiedy" },
];

const isLetter = (ch: string | undefined) => !!ch && /[\p{L}\p{N}]/u.test(ch);

/** Rozszerza trafienie do granic słowa (rdzeń „leniw” → „leniwy”) i opcjonalnie o poprzedzające „jest” / „był(a)”. */
function wordSpan(text: string, folded: string, at: number, length: number): [number, number] {
  let start = at;
  let end = at + length;
  while (isLetter(text[end])) end++;
  const before = folded.slice(Math.max(0, start - 12), start);
  const verb = /(jest|byl|byla|bywa|wydaje sie) $/.exec(before);
  if (verb) start -= verb[0].length;
  return [start, end];
}

function findAll(text: string, folded: string, stem: string): number[] {
  const out: number[] = [];
  let from = 0;
  for (;;) {
    const at = folded.indexOf(stem, from);
    if (at < 0) return out;
    // Tylko od początku słowa („leniw” w „leniwy”, ale nie w środku innego słowa).
    if (!isLetter(text[at - 1])) out.push(at);
    from = at + stem.length;
  }
}

/** Wykrywa opis osoby zamiast opisu zachowania. Wynik posortowany według pozycji, bez nakładających się fragmentów. */
export function detectLanguageIssues(text: string): LanguageIssue[] {
  if (!text.trim()) return [];
  const folded = foldText(text);
  const found: LanguageIssue[] = [];
  const add = (kind: LanguageIssueKind, list: { stem: string; hint: string }[]) => {
    for (const r of list) {
      for (const at of findAll(text, folded, r.stem)) {
        const [start, end] = kind === "UOGOLNIENIE" ? [at, at + r.stem.length] : wordSpan(text, folded, at, r.stem.trimEnd().length);
        found.push({ kind, phrase: text.slice(start, end), start, end, hint: r.hint });
      }
    }
  };
  add("ETYKIETA", LABELS);
  add("OCENA_OSOBY", TRAITS);
  add("UOGOLNIENIE", GENERALIZATIONS);

  found.sort((a, b) => a.start - b.start || b.end - a.end);
  const out: LanguageIssue[] = [];
  for (const f of found) if (!out.some((o) => f.start < o.end && o.start < f.end)) out.push(f);
  return out;
}

export const ISSUE_LABELS: Record<LanguageIssueKind, string> = {
  OCENA_OSOBY: "To opis osoby, nie zachowania.",
  ETYKIETA: "To etykieta, a nie opis zachowania.",
  UOGOLNIENIE: "To uogólnienie – trudno je sprawdzić.",
};
