// Wgranie sprawozdania z pierwszego okresu pracy (Z17): treść z pliku Word (.docx) albo tekstowego (.txt)
// trafia do FirstEvalReport.content, a nazwa pliku – do fileName. Samego pliku nie przechowujemy.

import { readDocx } from "@/lib/import/docx";
import { reportFileProblem } from "./przebieg";

export type ReportFileResult = { status: "none" } | { status: "error"; problem: string } | { status: "ok"; fileName: string; text: string };

export async function readReportFile(value: FormDataEntryValue | null): Promise<ReportFileResult> {
  if (!(value instanceof File) || value.size === 0) return { status: "none" };
  const problem = reportFileProblem(value);
  if (problem) return { status: "error", problem };
  try {
    const bytes = new Uint8Array(await value.arrayBuffer());
    const text = /\.txt$/i.test(value.name) ? new TextDecoder("utf-8").decode(bytes) : readDocx(bytes).text;
    if (!text.trim()) return { status: "error", problem: "W pliku nie ma tekstu. Sprawdź, czy to właściwe sprawozdanie." };
    return { status: "ok", fileName: value.name, text: text.trim().slice(0, 50_000) };
  } catch {
    return { status: "error", problem: "Nie udało się odczytać pliku. Sprawdź, czy to dokument Worda (.docx) albo plik tekstowy." };
  }
}
