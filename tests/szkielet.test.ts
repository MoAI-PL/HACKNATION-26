import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { cn } from "@/lib/utils";
import { GET } from "@/app/api/v1/status/route";

describe("szkielet aplikacji", () => {
  it("alias @/ i narzędzie cn działają", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("endpoint statusu zwraca ok", async () => {
    const res = GET();
    expect(await res.json()).toMatchObject({ status: "ok" });
  });

  it("materiały źródłowe są na miejscu", () => {
    for (const plik of [
      "materialy/Model_kompetencji.xlsx",
      "materialy/OSP/OSP_radca_DSI_WWI.docx",
      "materialy/ocena-okresowa/Arkusz_oceny_C.docx",
    ]) {
      expect(existsSync(plik), plik).toBe(true);
    }
  });
});
