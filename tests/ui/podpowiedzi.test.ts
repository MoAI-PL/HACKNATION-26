// Przepisy w kontekście (Z42): każda podpowiedź „Dlaczego?” ma cytat dosłownie z bazy wiedzy, właściwą jednostkę redakcyjną
// i link do aktu w ISAP; każda jest użyta na ekranie.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import knowledge from "../../data/wiedza/fragmenty.json";
import { HINT_IDS, SOURCE_LINKS, allHints, hint } from "@/lib/ui/dlaczego";

const fragments = new Map((knowledge as { fragments: { id: string; unit: string; text: string; publication?: string }[] }).fragments.map((f) => [f.id, f]));
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sourceFiles(p) : /\.tsx?$/.test(n) ? [p] : [];
  });
}

describe("podpowiedzi „Dlaczego?”", () => {
  it("komplet: każdy identyfikator ma treść i odwrotnie", () => {
    expect(allHints().map((h) => h.id).sort()).toEqual([...HINT_IDS].sort());
  });

  it.each(HINT_IDS.map((id) => [id]))("%s: cytat dosłownie z fragmentu bazy wiedzy", (id) => {
    const h = hint(id);
    const f = fragments.get(h.fragment);
    expect(f, `brak fragmentu ${h.fragment}`).toBeDefined();
    expect(norm(f!.text)).toContain(norm(h.quote));
  });

  it("podstawa prawna zawiera jednostkę redakcyjną fragmentu (rozporządzenie)", () => {
    for (const h of allHints().filter((x) => x.fragment.startsWith("ROZP_"))) {
      const unit = fragments.get(h.fragment)!.unit;
      // „§ 11 ust. 1” → podstawa „§ 11 ust. 1 pkt 5 …”; pouczenie z załącznika powołuje art. 83.
      if (unit.startsWith("§")) expect(h.legalBasis, h.id).toContain(unit.split(" ust.")[0]!);
      else expect(h.legalBasis, h.id).toMatch(/art\. 83/);
    }
  });

  it("link do ISAP zgodny z publikatorem z bazy wiedzy; FAQ bez linku", () => {
    for (const [doc, url] of Object.entries(SOURCE_LINKS)) {
      const pub = [...fragments.values()].find((f) => f.id.startsWith(`${doc}:`))!.publication!;
      const [, year, pos] = /Dz\.U\. (\d{4}) poz\. (\d+)/.exec(pub)!;
      expect(url).toBe(`https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU${year}${pos!.padStart(7, "0")}`);
    }
    expect(hint("KRYTERIA_DODATKOWE").href).toBe(SOURCE_LINKS.ROZP_OKRESOWE);
    expect(hint("NIEOBECNOSC").href).toBeUndefined();
  });

  it("przykład z opisu wyróżnika: maks. 3 kryteria dodatkowe – § 5 ust. 2", () => {
    expect(hint("KRYTERIA_DODATKOWE")).toMatchObject({ legalBasis: expect.stringContaining("§ 5 ust. 2") });
    expect(hint("KRYTERIA_DODATKOWE").quote).toContain("nie więcej niż 3 kryteria dodatkowe");
  });

  it("każda podpowiedź jest użyta na którymś ekranie", () => {
    const code = sourceFiles("src")
      .filter((p) => !p.endsWith("dlaczego.ts"))
      .map((p) => readFileSync(p, "utf8"))
      .join("\n");
    for (const id of HINT_IDS) expect(code, id).toMatch(new RegExp(`"${id}"`));
  });
});
