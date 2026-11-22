// Model kompetencji z data/model-kompetencji.json (tworzony przez `npm run model` z materialy/Model_kompetencji.xlsx).
// Walidacja przy starcie – uszkodzony plik zatrzymuje aplikację z czytelnym komunikatem, zamiast psuć ocenę.
//
// Użycie (szybka notatka …):
//   import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
//   competencyModel.getCompetency("KOMUNIKACJA").indicators
//   competencyModel.behaviorDescription("KOMUNIKACJA.2", 3)

import rawModel from "../../../data/model-kompetencji.json";
import { createCompetencyModelIndex, type CompetencyModelIndex } from "./model-kompetencji";

export const competencyModel: CompetencyModelIndex = createCompetencyModelIndex(rawModel);
