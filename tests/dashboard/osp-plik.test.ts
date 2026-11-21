import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { ospFileProblem, OSP_MAX_BYTES } from "@/lib/dashboard/nowy-pracownik";
import { ospPreview, readOspFile } from "@/lib/dashboard/osp-plik";

const plik = (sciezka: string, nazwa = sciezka.split("/").pop()!) => new File([readFileSync(sciezka)], nazwa);

describe("plik OSP w formularzu pracownika", () => {
  it("sprawdza format i rozmiar przed wysłaniem", () => {
    expect(ospFileProblem({ name: "osp.docx", size: 50_000 })).toBeNull();
    expect(ospFileProblem({ name: "osp.pdf", size: 50_000 })).toBe("Wybierz plik OSP w formacie Word (.docx).");
    expect(ospFileProblem({ name: "osp.docx", size: 0 })).toContain("pusty");
    expect(ospFileProblem({ name: "osp.docx", size: OSP_MAX_BYTES + 1 })).toContain("za duży");
  });

  it("brak pliku to nie błąd – dane można wpisać ręcznie", async () => {
    expect(await readOspFile(null)).toEqual({ status: "none" });
    expect(await readOspFile(new File([], "pusty.docx"))).toEqual({ status: "none" });
  });

  it("radca: stanowisko, komórka i arkusz C z wyjaśnieniem", async () => {
    const r = await readOspFile(plik("materialy/OSP/OSP_radca_DSI_WWI.docx"));
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    const p = ospPreview(r.result, r.fileName);
    expect(p.title.toLowerCase()).toContain("radca");
    expect(p.subordinates).toBe("BRAK");
    expect(p.sheet.sheet).toBe("C");
    expect(p.sheet.explanation.text).toContain("Wybrano arkusz C");
    expect(p.dominantTasksCount).toBeGreaterThan(0);
    expect(p.fileName).toBe("OSP_radca_DSI_WWI.docx");
  });

  it("naczelnik: 5–9 podległych → arkusz B", async () => {
    const r = await readOspFile(plik("materialy/OSP/OSP_naczelnik_DWM_WKAM.docx"));
    expect(r.status === "ok" && ospPreview(r.result, r.fileName).sheet.sheet).toBe("B");
  });

  it("plik, który nie jest OSP, daje czytelny błąd zamiast awarii", async () => {
    const r = await readOspFile(plik("materialy/ocena-okresowa/Arkusz_oceny_C.docx"));
    expect(r.status).toBe("error");
    if (r.status === "error") expect(r.problems.length).toBeGreaterThan(0);
    const zly = await readOspFile(new File([new Uint8Array([1, 2, 3])], "uszkodzony.docx"));
    expect(zly.status).toBe("error");
  });
});
