// Dane modelu kompetencji dla formularza obserwacji (przekazywane do komponentu w przeglądarce).
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
import type { CompetencyOption } from "./ObservationForm";

export function competencyOptions(): CompetencyOption[] {
  return competencyModel.competencies.map((c) => ({
    code: c.code,
    name: c.name,
    indicators: c.indicators.map((i) => ({ id: i.id, name: i.name, levels: [i.levels[1], i.levels[2], i.levels[3], i.levels[4], i.levels[5]] })),
  }));
}
