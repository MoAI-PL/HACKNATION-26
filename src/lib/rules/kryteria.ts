// Kryteria oceny okresowej: obowiązkowe według arkusza (§ 4) i walidacja dodatkowych (§ 5 ust. 2).
// Parametry z data/przepisy.json (parametr `r`, domyślnie `rules`).

import { rules as defaultRules, type Rules } from "@/lib/domain/przepisy";
import { COMPETENCY_NAMES, SHEET_LABELS } from "@/lib/domain/slownik";
import { COMPETENCY_CODES, type CompetencyCode, type CriteriaValidation, type Explanation, type PeriodicSheet } from "@/lib/domain/types";
import { plural } from "./tekst";

/** Kryteria obowiązkowe dla arkusza A, B albo C (§ 4). */
export function mandatoryCriteria(sheet: PeriodicSheet, r: Rules = defaultRules): CompetencyCode[] {
  return [...r.periodic.mandatoryCriteria[sheet]];
}

/** Kryteria, które można dodać jako dodatkowe: z wykazu 14 kryteriów, bez obowiązkowych dla arkusza. */
export function availableAdditionalCriteria(sheet: PeriodicSheet, r: Rules = defaultRules): CompetencyCode[] {
  const mandatory = new Set(r.periodic.mandatoryCriteria[sheet]);
  return COMPETENCY_CODES.filter((c) => !mandatory.has(c));
}

/**
 * Sprawdza wybór kryteriów dodatkowych: najwyżej 3 (§ 5 ust. 2), z wykazu kryteriów (§ 2 ust. 3),
 * bez powtórzeń kryteriów obowiązkowych (§ 4) i bez dublowania w obrębie wyboru.
 * Każdy błąd jest zdaniem zwykłym językiem, które mówi, co zrobić.
 */
export function validateAdditionalCriteria(
  sheet: PeriodicSheet,
  additional: readonly string[],
  r: Rules = defaultRules,
): CriteriaValidation {
  const lb = r.periodic.legalBasis;
  const max = r.periodic.maxAdditionalCriteria;
  const mandatory = new Set<string>(r.periodic.mandatoryCriteria[sheet]);
  const known = new Set<string>(COMPETENCY_CODES);
  const errors: Explanation[] = [];

  const unique = [...new Set(additional)];

  if (unique.length > max) {
    errors.push({
      text: `Wybrano ${unique.length} ${plural(unique.length, ["kryterium dodatkowe", "kryteria dodatkowe", "kryteriów dodatkowych"])}, a można najwyżej ${max}. Usuń ${unique.length - max}, zostawiając te najistotniejsze dla obowiązków z opisu stanowiska.`,
      legalBasis: lb.maxAdditionalCriteria,
    });
  }

  for (const c of unique) {
    if (!known.has(c)) {
      errors.push({
        text: `„${c}” nie jest kryterium z wykazu w załączniku nr 1 do rozporządzenia. Wybierz kryterium z listy.`,
        legalBasis: "§ 2 ust. 3",
      });
    } else if (mandatory.has(c)) {
      errors.push({
        text: `„${COMPETENCY_NAMES[c as CompetencyCode]}” jest już kryterium obowiązkowym (${SHEET_LABELS[sheet]}), więc nie może być dodatkowym. Wybierz inne kryterium.`,
        legalBasis: lb.mandatoryCriteria,
      });
    }
  }

  const duplicates = unique.filter((c) => additional.indexOf(c) !== additional.lastIndexOf(c));
  for (const c of duplicates) {
    const name = known.has(c) ? COMPETENCY_NAMES[c as CompetencyCode] : c;
    errors.push({ text: `Kryterium „${name}” wybrano więcej niż raz. Zostaw je tylko jeden raz.` });
  }

  return { valid: errors.length === 0, errors };
}
