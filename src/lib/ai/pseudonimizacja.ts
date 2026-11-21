// Pseudonimizacja przed wysłaniem tekstu do modelu językowego (Z34, zasada AI nr 3: dane osobowe nie wychodzą do modelu).
//
// Co zastępujemy znacznikami (w tej kolejności):
//  1. identyfikatory: adres e-mail, numer konta, PESEL, telefon, numer dowodu osobistego → [EMAIL_1], [NR_KONTA_1]…;
//  2. podwładnych – imiona i nazwiska z odmianą i zdrobnieniami („Kasią”, „Nowakowi”) → [OSOBA_1] (znacznik → id pracownika);
//  3. komórki organizacyjne pisane jako nazwa własna („w Departamencie Analiz”, „Wydział Kadr”) → [KOMORKA_1];
//  4. osoby spoza zespołu: po „pan / pani”, popularne imię z wielkiej litery, nazwisko o typowej końcówce (-ski, -cka, -wicz…) → [OSOBA_n].
// Ta sama osoba (także w innej formie) dostaje ten sam znacznik, a „[OSOBA_1] [OSOBA_1]” (imię i nazwisko) zwijamy do jednego.
// Oryginały znaczników są tylko po stronie serwera (`hidden`) – pozwalają przywrócić je w odpowiedzi modelu.
//
// ZAŁOŻENIE: rozpoznawanie osób spoza zespołu jest heurystyczne (docs/ZALOZENIA.md #21) – słownik popularnych imion
// i końcówek nazwisk. Dlatego funkcje, które przetwarzają dane pracowników, zawsze dostają listę podwładnych,
// a ostatnią linią obrony jest redactIdentifiers() w warstwie LLM (każde zapytanie do modelu).

import { plural } from "@/lib/rules/tekst";

export interface PseudoPerson {
  id: string;
  firstName: string;
  lastName: string;
}

export type PseudoCategory = "OSOBA" | "KOMORKA" | "EMAIL" | "NR_KONTA" | "PESEL" | "TELEFON" | "DOKUMENT";

export interface Pseudonymized {
  /** Tekst wysyłany do modelu. */
  text: string;
  /** Znacznik → id podwładnego. */
  tags: Record<string, string>;
  /** Podwładni wymienieni w tekście (w kolejności pierwszego wystąpienia). */
  mentioned: string[];
  /** Czy któreś słowo pasowało do więcej niż jednego podwładnego (np. dwie Marty). */
  ambiguous: boolean;
  /** Znacznik → oryginalny fragment (osoby spoza zespołu, komórki, identyfikatory). Nie wysyłamy go do modelu. */
  hidden: Record<string, string>;
  /** Liczba różnych ukrytych wartości w każdej kategorii. */
  counts: Partial<Record<PseudoCategory, number>>;
}

export interface PseudonymizeOptions {
  /** Ukrywać nazwy komórek organizacyjnych (domyślnie tak; w analizie OSP nie są danymi osobowymi). */
  units?: boolean;
  /** Rozpoznawać osoby spoza listy podwładnych (domyślnie tak). */
  otherPeople?: boolean;
}

// ---------------------------------------------------------------------------
// Odmiana imion i nazwisk
// ---------------------------------------------------------------------------

/** Małe litery, bez polskich znaków (ł → l), bez zmiany długości słowa. */
export function foldWord(word: string): string {
  return word
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");
}

// ZAŁOŻENIE: najczęstsze zdrobnienia imion. Przełożeni piszą notatki potocznie („Anka”, „Kasia”, „Piotrek”).
export const DIMINUTIVES: Record<string, string[]> = {
  anna: ["ania", "anka", "anusia", "anula"],
  katarzyna: ["kasia", "kaska", "kasienka"],
  piotr: ["piotrek", "piotrus"],
  jan: ["janek", "jas", "jasiu"],
  marcin: ["marcinek"],
  aleksandra: ["ola", "olka", "olenka"],
  aleksander: ["olek", "alek"],
  marta: ["martusia", "martunia"],
  maria: ["marysia", "marysienka"],
  magdalena: ["magda", "madzia"],
  malgorzata: ["gosia", "malgosia"],
  agnieszka: ["aga", "agusia"],
  krzysztof: ["krzysiek", "krzys"],
  tomasz: ["tomek"],
  pawel: ["pawelek"],
  michal: ["michalek"],
  andrzej: ["andrzejek", "jedrek"],
  ewa: ["ewka", "ewunia"],
  joanna: ["asia", "joasia"],
  barbara: ["basia"],
  elzbieta: ["ela"],
  zofia: ["zosia"],
  monika: ["monia"],
  tadeusz: ["tadek"],
  wojciech: ["wojtek"],
  grzegorz: ["grzesiek"],
  stanislaw: ["staszek"],
  jakub: ["kuba", "kubus"],
  mateusz: ["mateuszek"],
  dorota: ["dorotka"],
  beata: ["beatka"],
  lukasz: ["lukaszek"],
  bartosz: ["bartek"],
  przemyslaw: ["przemek"],
  zbigniew: ["zbyszek"],
  jaroslaw: ["jarek"],
  slawomir: ["slawek"],
  radoslaw: ["radek"],
  mikolaj: ["mikolajek"],
  natalia: ["natalka"],
  justyna: ["justynka"],
  karolina: ["karolinka"],
  weronika: ["werka"],
  zuzanna: ["zuzia"],
  izabela: ["iza"],
  grazyna: ["grazynka"],
  jolanta: ["jola"],
  wiktoria: ["wika"],
  emilia: ["emilka"],
  julia: ["julka"],
  patrycja: ["patka"],
};

const ENDINGS = ["", "a", "e", "i", "y", "ie", "ę", "ą", "o", "u", "em", "iem", "owi", "om", "ej", "iej", "ze", "ce", "ii", "io", "iu", "im", "ich", "iego", "iemu", "ego", "emu"].map(foldWord);

const SHORT_ENDINGS = ["a", "i", "ę", "ą", "o", "u"].map(foldWord);

/** Formy odmiany słowa (po foldWord): Anna → anny, annie, anną…; Piotrek → piotrka, piotrkiem; Paweł → pawła. */
export function inflections(word: string): Set<string> {
  const w = foldWord(word);
  const stems = new Set<string>([w]);
  if (/[aeiouy]$/.test(w)) stems.add(w.slice(0, -1)); // Anna → ann-, Kasia → kasi-
  if (w.endsWith("ek")) stems.add(`${w.slice(0, -2)}k`); // Piotrek → piotrk-
  if (w.endsWith("el")) stems.add(`${w.slice(0, -2)}l`); // Paweł → pawł-
  if (w.endsWith("ski") || w.endsWith("cki") || w.endsWith("dzki")) stems.add(w.slice(0, -1)); // Kowalski → kowalsk-
  const out = new Set<string>();
  for (const s of stems) {
    if (s.length < 2) continue;
    // Krótki rdzeń (Ola → ol-) tylko z końcówkami rzeczownika, żeby „olej” nie był imieniem.
    for (const e of s.length < 3 ? SHORT_ENDINGS : ENDINGS) out.add(s + e);
    // Oboczności w celowniku i miejscowniku: Marta → Marcie, Agnieszka → Agnieszce, Magda → Magdzie, Olga → Oldze.
    if (s.endsWith("t")) out.add(`${s.slice(0, -1)}cie`);
    if (s.endsWith("k")) out.add(`${s.slice(0, -1)}ce`);
    if (s.endsWith("d")) out.add(`${s.slice(0, -1)}dzie`);
    if (s.endsWith("g")) out.add(`${s.slice(0, -1)}dze`);
  }
  out.add(w);
  return out;
}

// Krótkie słowa, które przypadkiem pokrywają się z formą imienia (np. „ani” jako spójnik).
const NOT_NAMES = new Set(["ani", "ale", "jasne", "jasno", "agi"]);

// ZAŁOŻENIE: popularne imiona w Polsce (mianownik, po foldWord). Pominięte imiona będące zwykłymi słowami (Róża, Jagoda, Maja).
const FIRST_NAMES = [
  // żeńskie
  "anna", "maria", "katarzyna", "malgorzata", "agnieszka", "barbara", "ewa", "krystyna", "elzbieta", "zofia", "teresa",
  "magdalena", "joanna", "janina", "monika", "danuta", "jadwiga", "aleksandra", "halina", "irena", "beata", "marta",
  "dorota", "karolina", "jolanta", "iwona", "natalia", "julia", "grazyna", "bozena", "renata", "justyna", "paulina",
  "urszula", "agata", "wanda", "hanna", "alicja", "emilia", "patrycja", "weronika", "izabela", "kinga", "dominika",
  "ewelina", "sylwia", "edyta", "wioletta", "zuzanna", "kamila", "martyna", "oliwia", "wiktoria", "gabriela", "klaudia",
  "marzena", "lucyna", "helena", "nadia", "sandra", "angelika", "adrianna", "amelia", "laura", "antonina", "michalina",
  "zaneta", "milena", "lidia", "ilona", "aneta", "kamila", "jowita", "honorata", "stanislawa", "genowefa", "zuzanna",
  // męskie
  "piotr", "krzysztof", "andrzej", "tomasz", "jan", "pawel", "michal", "marcin", "jakub", "adam", "marek", "lukasz",
  "grzegorz", "mateusz", "wojciech", "mariusz", "dariusz", "zbigniew", "jerzy", "maciej", "rafal", "robert", "kamil",
  "jozef", "janusz", "dawid", "damian", "ryszard", "kazimierz", "stanislaw", "jacek", "sebastian", "slawomir", "artur",
  "henryk", "tadeusz", "bartosz", "daniel", "przemyslaw", "kacper", "szymon", "filip", "patryk", "waldemar", "wieslaw",
  "zdzislaw", "mieczyslaw", "leszek", "aleksander", "hubert", "karol", "konrad", "krystian", "norbert", "emil",
  "mikolaj", "igor", "adrian", "radoslaw", "arkadiusz", "sylwester", "edward", "jaroslaw", "boguslaw", "zenon",
  "witold", "lech", "ireneusz", "eugeniusz", "bogdan", "dominik", "michal", "wiktor", "antoni", "franciszek",
];

function formsOfFirstName(name: string): Set<string> {
  const forms = new Set(inflections(name));
  for (const d of DIMINUTIVES[foldWord(name)] ?? []) for (const f of inflections(d)) forms.add(f);
  for (const f of NOT_NAMES) forms.delete(f);
  return forms;
}

const FIRST_NAME_FORMS: ReadonlySet<string> = new Set(FIRST_NAMES.flatMap((n) => [...formsOfFirstName(n)]));

// Typowe końcówki nazwisk (po foldWord), także w odmianie: Kowalski, Kowalskiej, Nowickiego, Mickiewicza, Wójcikowa.
const SURNAME_ENDING =
  /(?:sk|ck|dzk)(?:i|a|iego|iej|iemu|im|ie)$|(?:wicz|icz)(?:a|em|owi|u|owa|owej|owna)?$|(?:czyk|czak|niak)(?:a|iem|owi|u)?$/;

// Przymiotniki o końcówce nazwiska, które z wielkiej litery pojawiają się w zwykłym tekście (początek zdania, nazwy własne).
const NOT_SURNAMES = [
  "polsk", "angielsk", "niemieck", "francusk", "rosyjsk", "hiszpansk", "wlosk", "czesk", "ukrainsk", "europejsk",
  "warszawsk", "krakowsk", "gdansk", "wroclawsk", "poznansk", "lodzk", "slask", "mazowieck", "malopolsk", "wielkopolsk",
  "pomorsk", "lubelsk", "podlask", "swietokrzysk", "lubusk", "opolsk", "kujawsk", "zachodniopomorsk", "warminsk",
  "nisk", "blisk", "wask", "slisk", "ludzk", "miejsk", "wiejsk", "morsk", "gorsk", "mesk", "zensk", "dziecick",
  "greck", "tureck", "plock", "slupsk", "bielsk", "minsk", "smolensk", "bialostock", "wojewodzk", "obywatelsk",
  "polnocnoatlantyck", "atlantyck", "baltyck", "amerykansk", "brytyjsk", "litewsk", "slowack", "wegiersk", "szwedzk",
  "dunsk", "norwesk", "finsk", "holendersk", "belgijsk", "austriack", "szwajcarsk", "irlandzk", "rumunsk", "bulgarsk",
  "chorwack", "lotewsk", "estonsk", "bialorusk", "izraelsk", "chinsk", "japonsk", "indyjsk", "kanadyjsk", "arabsk",
  "podkarpack", "kaszubsk", "mazursk", "katolick", "chrzescijansk", "zydowsk", "plask", "niebiesk", "krolewsk",
  "sasiedzk", "przyjaciel", "kolezensk", "senack", "prezydenck", "kanclersk", "parlamentarn", "trosk", "desk", "unijn", "akademick", "uniwersyteck", "techniczn", "ministerialn", "bratersk", "rodzinn",
];

function isSurnameLike(word: string): boolean {
  const f = foldWord(word);
  return f.length >= 5 && SURNAME_ENDING.test(f) && !NOT_SURNAMES.some((s) => f.startsWith(s));
}

const TITLES = new Set(["pan", "pani", "pana", "panu", "panem", "pania", "panie", "panstwo", "panstwa"]);

// Stanowiska po „pan / pani” – nie są nazwiskiem („Pani Dyrektor Kowalska” → ukrywamy tylko „Kowalska”).
const POSITIONS = [
  "dyrektor", "minister", "naczelnik", "prezes", "kierownik", "wojewod", "sekretarz", "premier", "doktor", "profesor",
  "mecenas", "radc", "inspektor", "starost", "burmistrz", "prezydent", "szef", "przewodnicz", "specjalist", "zastepc",
  "kierujac", "koordynator", "ekspert", "referendarz", "rzecznik", "posel", "posl", "senator", "marszal", "komendant",
];

const isPosition = (word: string) => POSITIONS.some((p) => foldWord(word).startsWith(p));
const isCapitalized = (word: string) => /^\p{Lu}\p{Ll}/u.test(word);

// ---------------------------------------------------------------------------
// Identyfikatory
// ---------------------------------------------------------------------------

const IDENTIFIERS: { category: PseudoCategory; pattern: RegExp }[] = [
  { category: "EMAIL", pattern: /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)*\.\p{L}{2,}/gu },
  // 26 cyfr (NRB / IBAN), także w grupach po 4 cyfry.
  { category: "NR_KONTA", pattern: /(?<![\p{L}\p{N}])(?:PL ?)?\d{2}(?: ?\d{4}){6}(?!\p{N})/gu },
  { category: "PESEL", pattern: /(?<![\p{L}\p{N}])\d{11}(?!\p{N})/gu },
  {
    category: "TELEFON",
    pattern: /(?<![\p{L}\p{N}+])(?:(?:\+|00)48[ -]?)?(?:\d{3}[ -]?\d{3}[ -]?\d{3}|\(?\d{2}\)?[ -]\d{3}[ -]\d{2}[ -]\d{2})(?!\p{N})/gu,
  },
  // Dowód osobisty: 3 litery i 6 cyfr (ABC123456).
  { category: "DOKUMENT", pattern: /(?<![\p{L}\p{N}])\p{Lu}{3} ?\d{6}(?!\p{N})/gu },
];

// Komórka organizacyjna jako nazwa własna: słowo kluczowe z wielkiej litery i dalsze słowa z wielkiej litery
// (dopuszczamy „ds.”, „do spraw”, „i”, „oraz” w środku), np. „Departamencie Analiz i Strategii”, „Biuro Dyrektora Generalnego”.
const UNIT_PATTERN =
  /(?<![\p{L}\p{N}])(?:Departamen[tc]|Wydzia[łl]|Biur|Refera[tc]|Sekcj|Zesp[oó]|Gabine[tc]|Delegatur|Oddzia[łl]|Inspektora[tc]|Samodzieln\p{L}* [Ss]tanowisk)\p{L}*(?: (?:(?:ds\.|do spraw|i|oraz|w|z|ze|dla) )*\p{Lu}[\p{L}-]*)+/gu;

// ---------------------------------------------------------------------------
// Pseudonimizacja
// ---------------------------------------------------------------------------

/** Zamienia dane osobowe na znaczniki – opis kroków na początku pliku. */
export function pseudonymize(text: string, people: readonly PseudoPerson[] = [], options: PseudonymizeOptions = {}): Pseudonymized {
  const tags: Record<string, string> = {};
  const hidden: Record<string, string> = {};
  const counts: Partial<Record<PseudoCategory, number>> = {};
  const mentioned: string[] = [];
  let ambiguous = false;
  let personCount = 0;

  const newTag = (category: PseudoCategory) => {
    const n = category === "OSOBA" ? ++personCount : (counts[category] ?? 0) + 1;
    counts[category] = (counts[category] ?? 0) + 1;
    return `${category}_${n}`;
  };

  // 1. Identyfikatory – ta sama wartość = ten sam znacznik.
  let out = text;
  for (const { category, pattern } of IDENTIFIERS) {
    const seen = new Map<string, string>();
    out = out.replace(pattern, (m) => {
      const key = m.replace(/[\s()-]/g, "");
      let tag = seen.get(key);
      if (!tag) {
        tag = newTag(category);
        seen.set(key, tag);
        hidden[tag] = m;
      }
      return `[${tag}]`;
    });
  }

  // 2. Podwładni (wielkość liter bez znaczenia – notatki pisane są w pośpiechu).
  const formsByPerson = people.map((p) => {
    const forms = new Set<string>([...formsOfFirstName(p.firstName), ...inflections(p.lastName)]);
    for (const f of NOT_NAMES) forms.delete(f);
    return { id: p.id, forms };
  });
  const tagOf = new Map<string, string>();
  if (formsByPerson.length > 0) {
    out = out.replace(/\[[A-Z_]+(?:_\d+)?\]|\p{L}+/gu, (word) => {
      if (word.startsWith("[")) return word;
      const f = foldWord(word);
      const hits = formsByPerson.filter((p) => p.forms.has(f));
      if (hits.length === 0) return word;
      if (hits.length > 1) {
        ambiguous = true;
        return "[OSOBA]";
      }
      const id = hits[0]!.id;
      let tag = tagOf.get(id);
      if (!tag) {
        tag = newTag("OSOBA");
        tagOf.set(id, tag);
        tags[tag] = id;
        mentioned.push(id);
      }
      return `[${tag}]`;
    });
  }

  // 3. Komórki organizacyjne.
  if (options.units !== false) {
    const seen = new Map<string, string>();
    out = out.replace(UNIT_PATTERN, (m) => {
      const key = foldWord(m).replace(/\s+/g, " ");
      let tag = seen.get(key);
      if (!tag) {
        tag = newTag("KOMORKA");
        seen.set(key, tag);
        hidden[tag] = m;
      }
      return `[${tag}]`;
    });
  }

  // 4. Osoby spoza zespołu.
  if (options.otherPeople !== false) out = hideOtherPeople(out, newTag, hidden);

  // „[OSOBA_1] [OSOBA_1]” (imię i nazwisko tej samej osoby) → jeden znacznik.
  out = out.replace(/\[(OSOBA_\d+)\](?:[ -]\[\1\])+/g, "[$1]");

  return { text: out, tags, mentioned, ambiguous, hidden, counts };
}

/** Osoby spoza listy podwładnych: „pan / pani” + nazwisko, popularne imię, nazwisko o typowej końcówce. */
function hideOtherPeople(text: string, newTag: (c: PseudoCategory) => string, hidden: Record<string, string>): string {
  // Słowa i to, co między nimi; znaczniki [X_1] są jednym „słowem”, którego nie ruszamy.
  const parts = text.split(/(\[[A-Z_]+(?:_\d+)?\]|\p{L}+(?:-\p{L}+)*)/u);
  const isWord = (i: number) => i % 2 === 1 && !parts[i]!.startsWith("[");
  const onlySpace = (i: number) => /^[ \t]+$/.test(parts[i] ?? "");
  const sentenceStart = (i: number) => {
    const before = parts.slice(0, i).join("").trimEnd();
    return before === "" || /[.!?:\n]$/.test(before) || /["„(]$/.test(before);
  };

  const tagByLastWord = new Map<string, string>();
  for (let i = 1; i < parts.length; i += 2) {
    if (!isWord(i)) continue;
    const word = parts[i]!;
    let start = -1;

    if (TITLES.has(foldWord(word)) && onlySpace(i + 1) && isWord(i + 2)) {
      // „pani Kowalska”, „Pani Dyrektor Kowalska” (stanowisko pomijamy).
      let j = i + 2;
      if (isPosition(parts[j]!) && onlySpace(j + 1) && isWord(j + 2)) j += 2;
      if (isCapitalized(parts[j]!) && !isPosition(parts[j]!)) start = j;
    } else if (isCapitalized(word) && FIRST_NAME_FORMS.has(foldWord(word))) {
      start = i;
    } else if (isCapitalized(word) && isSurnameLike(word) && !sentenceStart(i)) {
      start = i;
    } else if (isCapitalized(word) && isSurnameLike(word) && onlySpace(i + 1) && isWord(i + 2) && FIRST_NAME_FORMS.has(foldWord(parts[i + 2]!))) {
      // „Kowalski Jan” na początku zdania.
      start = i;
    }
    if (start < 0) continue;

    // Dalsze słowa z wielkiej litery (drugie imię, nazwisko) – najwyżej 3 słowa razem.
    let end = start;
    while (end - start < 4 && onlySpace(end + 1) && isWord(end + 2) && isCapitalized(parts[end + 2]!) && !TITLES.has(foldWord(parts[end + 2]!))) end += 2;

    const original = parts.slice(start, end + 1).join("");
    const lastWord = foldWord(parts[end]!);
    // Ta sama osoba w innej formie („Kowalski” → „Kowalskiego”): wspólna forma ostatniego słowa.
    let tag = [...tagByLastWord.entries()].find(([w]) => w === lastWord || inflections(w).has(lastWord) || inflections(lastWord).has(w))?.[1];
    if (!tag) {
      tag = newTag("OSOBA");
      hidden[tag] = original;
    }
    tagByLastWord.set(lastWord, tag);
    parts.splice(start, end - start + 1, `[${tag}]`);
    i = start;
  }

  // Druga runda: ta sama osoba w miejscu, którego pierwsza runda nie rozpoznała
  // („Kowalski spóźnił się…” na początku zdania, a dalej „…Kowalskiego nie było”).
  if (tagByLastWord.size > 0) {
    const known = [...tagByLastWord.entries()].map(([word, tag]) => ({ word, forms: inflections(word), tag }));
    for (let i = 1; i < parts.length; i += 2) {
      if (!isWord(i) || !isCapitalized(parts[i]!)) continue;
      const f = foldWord(parts[i]!);
      const hit = known.find((k) => k.forms.has(f) || inflections(f).has(k.word));
      if (hit) parts[i] = `[${hit.tag}]`;
    }
  }
  return parts.join("");
}

/**
 * Pseudonimizacja kilku pól naraz (np. zadania z OSP) – wspólne znaczniki dla całego dokumentu.
 * Pola łączymy znakiem, który nie występuje w tekście i przerywa każde dopasowanie.
 */
export function pseudonymizeMany(
  texts: readonly string[],
  people: readonly PseudoPerson[] = [],
  options: PseudonymizeOptions = {},
): Pseudonymized & { texts: string[] } {
  const SEP = "\n␞\n";
  const p = pseudonymize(texts.join(SEP), people, options);
  return { ...p, texts: p.text.split(SEP) };
}

const TAG_PATTERN = /\[?\b((?:OSOBA|KOMORKA|EMAIL|NR_KONTA|PESEL|TELEFON|DOKUMENT)(?:_\d+)?)\b\]?/g;

/**
 * Znaczniki w odpowiedzi modelu → z powrotem dane: podwładny = imię (mianownik), pozostałe = oryginalny fragment.
 * Nieznany znacznik osoby → „osoba”.
 */
export function restoreNames(
  text: string,
  tags: Record<string, string>,
  people: readonly PseudoPerson[],
  hidden: Record<string, string> = {},
): string {
  return text.replace(TAG_PATTERN, (m, tag: string) => {
    const person = people.find((p) => p.id === tags[tag]);
    if (person) return person.firstName;
    if (hidden[tag]) return hidden[tag];
    return tag.startsWith("OSOBA") ? "osoba" : m;
  });
}

/**
 * Ostatnia linia obrony w warstwie LLM: identyfikatory (e-mail, konto, PESEL, telefon, dowód) w każdym zapytaniu.
 * Imion nie ruszamy – to zadanie funkcji, która zna listę podwładnych (pseudonymize).
 */
export function redactIdentifiers(text: string): string {
  let out = text;
  for (const { category, pattern } of IDENTIFIERS) out = out.replace(pattern, `[${category}]`);
  return out;
}

const COUNT_WORDS: Record<PseudoCategory, [string, string, string]> = {
  OSOBA: ["osobę", "osoby", "osób"],
  KOMORKA: ["komórkę organizacyjną", "komórki organizacyjne", "komórek organizacyjnych"],
  EMAIL: ["adres e-mail", "adresy e-mail", "adresów e-mail"],
  NR_KONTA: ["numer konta", "numery kont", "numerów kont"],
  PESEL: ["numer PESEL", "numery PESEL", "numerów PESEL"],
  TELEFON: ["numer telefonu", "numery telefonów", "numerów telefonów"],
  DOKUMENT: ["numer dokumentu", "numery dokumentów", "numerów dokumentów"],
};

/** „Przed wysłaniem do modelu ukryto: 2 osoby, 1 adres e-mail.” albo null, gdy nic nie ukryto. */
export function describeHidden(counts: Partial<Record<PseudoCategory, number>>): string | null {
  const items = (Object.keys(COUNT_WORDS) as PseudoCategory[])
    .filter((c) => (counts[c] ?? 0) > 0)
    .map((c) => `${counts[c]} ${plural(counts[c]!, COUNT_WORDS[c])}`);
  return items.length ? `Przed wysłaniem do modelu ukryto: ${items.join(", ")}.` : null;
}
