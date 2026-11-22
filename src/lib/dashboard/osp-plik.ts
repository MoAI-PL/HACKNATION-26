// Odczyt pliku OSP przesłanego z formularza pulpitu – parser i wybór arkusza dostarcza moduł importu OSP.
import { OspImportError, parseOsp, type OspImportResult } from "@/lib/import/osp";
import type { SheetSelection, SubordinateOption } from "@/lib/domain/types";
import { ospFileProblem } from "./nowy-pracownik";

export type OspFileResult =
  | { status: "none" }
  | { status: "error"; problems: string[] }
  | { status: "ok"; result: OspImportResult; fileName: string };

/** Podgląd do formularza – tylko dane, które formularz wypełnia, i wyjaśnienie wyboru arkusza. */
export interface OspPreview {
  fileName: string;
  title: string;
  orgUnit?: string;
  symbol?: string;
  subordinates: SubordinateOption;
  sheet: SheetSelection;
  dominantTasksCount: number;
  warnings: string[];
}

export async function readOspFile(value: FormDataEntryValue | null): Promise<OspFileResult> {
  if (!(value instanceof File) || value.size === 0) return { status: "none" };
  const problem = ospFileProblem(value);
  if (problem) return { status: "error", problems: [problem] };
  try {
    const result = parseOsp(new Uint8Array(await value.arrayBuffer()));
    return { status: "ok", result, fileName: value.name };
  } catch (e) {
    if (e instanceof OspImportError) return { status: "error", problems: e.problems };
    return { status: "error", problems: ["Nie udało się odczytać pliku. Sprawdź, czy to opis stanowiska pracy w formacie .docx."] };
  }
}

export function ospPreview(r: OspImportResult, fileName: string): OspPreview {
  return {
    fileName,
    title: r.position.title,
    orgUnit: r.position.orgUnit,
    symbol: r.position.symbol,
    subordinates: r.position.subordinates,
    sheet: r.sheet,
    dominantTasksCount: r.position.dominantTasks.length,
    warnings: r.warnings,
  };
}
