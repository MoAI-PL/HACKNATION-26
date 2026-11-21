// Pomocnicze formatowanie tekstów wyjaśnień silnika reguł (liczby i odmiana po polsku).

/** Liczba z dwoma miejscami po przecinku, np. 4 → "4,00", 5.4 → "5,40". */
export function formatPoints(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

/**
 * Odmiana rzeczownika przez liczbę: 1 ocena, 2–4 oceny, 5+ ocen (12–14 zawsze „ocen”).
 * forms = [mianownik l. poj., mianownik l. mn., dopełniacz l. mn.]
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  if (abs === 1) return forms[0];
  const lastDigit = abs % 10;
  const lastTwo = abs % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return forms[1];
  return forms[2];
}

/** „1 ocena cząstkowa”, „2 oceny cząstkowe”, „5 ocen cząstkowych”. */
export function partialScoresCount(n: number): string {
  return `${n} ${plural(n, ["ocena cząstkowa", "oceny cząstkowe", "ocen cząstkowych"])}`;
}

/** „1 pkt” – skrót jest nieodmienny. */
export function pts(n: number): string {
  return `${n} pkt`;
}
