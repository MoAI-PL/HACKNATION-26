// Szybkie dodanie pracownika z pulpitu – walidacja i wybór arkusza. Czysta logika, testy w tests/dashboard.
// Import pliku OSP (docx) robi parser OSP; tutaj przełożony odpowiada na jedno pytanie z OSP: liczba podległych pracowników.

import { z } from "zod";
import { rules } from "@/lib/domain/przepisy";
import { SUBORDINATE_LABELS } from "@/lib/domain/slownik";
import { SUBORDINATE_OPTIONS, type Sheet, type SubordinateOption } from "@/lib/domain/types";
import { isIsoDate } from "@/lib/domain/daty";

const date = z.string().refine((v) => isIsoDate(v), "Podaj datę w formacie dd.mm.rrrr.");
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined))
  .refine((v) => v === undefined || isIsoDate(v), "Podaj datę w formacie dd.mm.rrrr.");

export const newEmployeeSchema = z
  .object({
    firstName: z.string().trim().min(2, "Wpisz imię pracownika."),
    lastName: z.string().trim().min(2, "Wpisz nazwisko pracownika."),
    positionTitle: z.string().trim().min(2, "Wpisz nazwę stanowiska, np. „starszy specjalista”."),
    orgUnit: z.string().trim().optional().transform((v) => v || undefined),
    subordinates: z.enum(SUBORDINATE_OPTIONS, { message: "Zaznacz, czy osoba kieruje pracą innych (pole z OSP)." }),
    evaluationType: z.enum(["OKRESOWA", "PIERWSZA"], { message: "Wybierz rodzaj oceny." }),
    isCivilServant: z.boolean(),
    employmentStart: date,
    /** Ocena okresowa: zatrudnienie na czas nieokreślony albo ostatnia ocena – od tego biegną terminy. */
    permanentFrom: optionalDate,
    lastEvaluationAt: optionalDate,
    /** Pierwsza ocena: koniec umowy na czas określony. */
    contractEnd: optionalDate,
  })
  .superRefine((v, ctx) => {
    if (v.evaluationType === "OKRESOWA" && !v.permanentFrom && !v.lastEvaluationAt) {
      ctx.addIssue({
        code: "custom",
        path: ["permanentFrom"],
        message: "Podaj datę zatrudnienia na czas nieokreślony albo datę ostatniej oceny – od niej liczymy terminy (art. 81 ustawy).",
      });
    }
    if (v.evaluationType === "PIERWSZA" && !v.contractEnd) {
      ctx.addIssue({
        code: "custom",
        path: ["contractEnd"],
        message: "Podaj koniec umowy – pierwszą ocenę trzeba sporządzić najpóźniej miesiąc przed nim (art. 38 ustawy).",
      });
    }
    if (v.contractEnd && v.contractEnd <= v.employmentStart) {
      ctx.addIssue({ code: "custom", path: ["contractEnd"], message: "Koniec umowy musi być późniejszy niż data zatrudnienia." });
    }
  });

export type NewEmployeeInput = z.infer<typeof newEmployeeSchema>;

/** Pola formularza → dane do walidacji (checkbox i puste pola z FormData). */
export function parseNewEmployeeForm(form: FormData) {
  const text = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : undefined;
  };
  return newEmployeeSchema.safeParse({
    firstName: text("firstName") ?? "",
    lastName: text("lastName") ?? "",
    positionTitle: text("positionTitle") ?? "",
    orgUnit: text("orgUnit"),
    subordinates: text("subordinates"),
    evaluationType: text("evaluationType"),
    isCivilServant: form.get("isCivilServant") === "on",
    employmentStart: text("employmentStart") ?? "",
    permanentFrom: text("permanentFrom"),
    lastEvaluationAt: text("lastEvaluationAt"),
    contractEnd: text("contractEnd"),
  });
}

/** Arkusz oceny okresowej z pola OSP o podległych pracownikach (§ 3 rozporządzenia). */
export function sheetForSubordinates(option: SubordinateOption): Exclude<Sheet, "A" | "PIERWSZA"> {
  return rules.periodic.sheetBySubordinates[option];
}

/** Wyjaśnienie wyboru arkusza zwykłym językiem, np. „Arkusz C, bo w OSP zaznaczono »brak podległych pracowników« (§ 3 ust. 4).” */
export function sheetExplanation(option: SubordinateOption): string {
  const sheet = sheetForSubordinates(option);
  const unit = sheet === "B" ? "§ 3 ust. 3" : "§ 3 ust. 4";
  return `Arkusz ${sheet}, bo w OSP zaznaczono „${SUBORDINATE_LABELS[option]}” (${unit}).`;
}

export type FieldErrors = Partial<Record<keyof NewEmployeeInput, string>>;

export function fieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof NewEmployeeInput | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Plik OSP – sprawdzenie przed wysłaniem (także w przeglądarce; parser OSP działa tylko na serwerze)
// ---------------------------------------------------------------------------

/** Akcje serwerowe Next.js przyjmują domyślnie do 1 MB – pliki OSP mają ok. 50 KB. */
export const OSP_MAX_BYTES = 900 * 1024;

/** Problem z plikiem OSP albo null, gdy plik jest w porządku. */
export function ospFileProblem(file: { name: string; size: number }): string | null {
  if (!/\.docx$/i.test(file.name)) return "Wybierz plik OSP w formacie Word (.docx).";
  if (file.size === 0) return "Plik jest pusty. Wybierz inny plik OSP.";
  if (file.size > OSP_MAX_BYTES) return "Plik OSP jest za duży (najwyżej 900 KB). Zapisz go bez obrazków albo wpisz dane ręcznie.";
  return null;
}
