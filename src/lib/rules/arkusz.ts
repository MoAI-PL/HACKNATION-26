// Automatyczny wybór arkusza oceny okresowej z opisu stanowiska pracy (§ 3 rozporządzenia).
// § 3 rozporządzenia: arkusz B – stanowisko, na którym praca polega na bezpośrednim kierowaniu pracownikami;
// arkusz C – pozostałe stanowiska. Rozstrzyga pole OSP „LICZBA PODLEGŁYCH PRACOWNIKÓW” (mapa w data/przepisy.json).

import { rules as defaultRules, type Rules } from "@/lib/domain/przepisy";
import { SUBORDINATE_LABELS } from "@/lib/domain/slownik";
import type { SheetSelection, SubordinateOption } from "@/lib/domain/types";
import { RulesInputError } from "./bledy";

export function selectSheet(subordinates: SubordinateOption, r: Rules = defaultRules): SheetSelection {
  const sheet = r.periodic.sheetBySubordinates[subordinates];
  if (!sheet) throw new RulesInputError(`Nieznana opcja pola „Liczba podległych pracowników”: ${subordinates}.`);
  const option = SUBORDINATE_LABELS[subordinates];
  const text =
    sheet === "C"
      ? `Wybrano arkusz C, bo w OSP zaznaczono „${option}”. Arkusz B dotyczy tylko stanowisk, na których praca polega na bezpośrednim kierowaniu pracownikami.`
      : `Wybrano arkusz B, bo w OSP zaznaczono „${option}” – praca na tym stanowisku polega na bezpośrednim kierowaniu pracownikami.`;
  return {
    sheet,
    subordinates,
    mandatoryCriteria: [...r.periodic.mandatoryCriteria[sheet]],
    explanation: { text, legalBasis: r.periodic.legalBasis.sheets },
  };
}
