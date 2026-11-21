// Ujednolicanie tekstu z plików Office (xlsx, docx) – wspólne dla importów.

/** Łamania linii, tabulatory i twarde spacje → spacja; bez miękkich łączników, podwójnych spacji i spacji na końcach. */
export function normalizeText(value: string): string {
  return value
    .replace(/­/g, "")
    .replace(/[\s   ]+/g, " ")
    .trim();
}

/** Porównanie bez wielkości liter i różnic w białych znakach („ORGANIZACJA PRACY i …” = „Organizacja pracy i …”). */
export function sameText(a: string, b: string): boolean {
  return normalizeText(a).toLocaleLowerCase("pl") === normalizeText(b).toLocaleLowerCase("pl");
}
