// Przepisy w kontekście: treści „ⓘ Dlaczego?” przy polach i krokach.
// Źródło: data/podpowiedzi.json – krótkie wyjaśnienie, jednostka redakcyjna i dosłowny cytat z bazy wiedzy.
// Mały plik (bez całej bazy wiedzy), więc można go używać także w komponentach przeglądarki.
// Zgodność cytatów z bazą wiedzy i komplet identyfikatorów sprawdza tests/ui/podpowiedzi.test.ts.

import { z } from "zod";
import data from "../../../data/podpowiedzi.json";

export const HINT_IDS = [
  "ARKUSZ",
  "KRYTERIA_OBOWIAZKOWE",
  "KRYTERIA_DODATKOWE",
  "ROZMOWA_ROZPOCZYNAJACA",
  "TERMIN_ROZMOWY_ROZPOCZYNAJACEJ",
  "CZESC_I",
  "NIEOBECNOSC",
  "ZMIANA_STANOWISKA",
  "OCENA_CZASTKOWA",
  "SKALA_OCEN",
  "WYNIK_OCENY",
  "ROZMOWA_OCENIAJACA",
  "UZASADNIENIE",
  "IPRZ",
  "WNIOSEK_O_STOPIEN",
  "ZAPOZNANIE",
  "SPRZECIW",
] as const;
export type HintId = (typeof HINT_IDS)[number];

const hintsSchema = z.object({
  podpowiedzi: z.array(
    z.object({
      id: z.enum(HINT_IDS),
      temat: z.string().min(3),
      tekst: z.string().min(10),
      podstawa: z.string().min(3),
      fragment: z.string().min(3),
      cytat: z.string().min(10),
    }),
  ),
});

export interface Hint {
  id: HintId;
  /** Temat do nazwy przycisku dla czytnika ekranu, np. „kryteria dodatkowe”. */
  topic: string;
  text: string;
  legalBasis: string;
  /** Identyfikator fragmentu bazy wiedzy, z którego pochodzi cytat. */
  fragment: string;
  quote: string;
  /** Tekst aktu w ISAP (dla rozporządzeń); FAQ i poradniki nie mają publicznego adresu. */
  href?: string;
}

/** Rozporządzenia w Internetowym Systemie Aktów Prawnych (publikatory z bazy wiedzy: Dz.U. 2016 poz. 470, Dz.U. 2015 poz. 1144). */
export const SOURCE_LINKS: Record<string, string> = {
  ROZP_OKRESOWE: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20160000470",
  ROZP_PIERWSZA: "https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20150001144",
};

const HINTS: ReadonlyMap<HintId, Hint> = new Map(
  hintsSchema.parse(data).podpowiedzi.map((h) => [
    h.id,
    {
      id: h.id,
      topic: h.temat,
      text: h.tekst,
      legalBasis: h.podstawa,
      fragment: h.fragment,
      quote: h.cytat,
      href: SOURCE_LINKS[h.fragment.split(":")[0]!],
    },
  ]),
);

/** Podpowiedź „Dlaczego?” – brak treści to błąd programisty (test pilnuje kompletu). */
export function hint(id: HintId): Hint {
  const h = HINTS.get(id);
  if (!h) throw new Error(`Brak podpowiedzi „${id}” w data/podpowiedzi.json`);
  return h;
}

export function allHints(): Hint[] {
  return [...HINTS.values()];
}
