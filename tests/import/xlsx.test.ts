import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { XlsxReadError, cellAddress, columnLetter, readXlsx } from "@/lib/import/xlsx";
import { buildXlsx } from "./xlsx-fabryka";

describe("czytnik xlsx", () => {
  it("adresy komórek", () => {
    expect(columnLetter(1)).toBe("A");
    expect(columnLetter(26)).toBe("Z");
    expect(columnLetter(27)).toBe("AA");
    expect(cellAddress(3, 6)).toBe("F3");
  });

  it.each([false, true])("czyta tekst, polskie znaki i znaki specjalne (prefiks przestrzeni nazw: %s)", (prefixed) => {
    const wb = readXlsx(buildXlsx({ Arkusz: [["Zażółć gęślą jaźń", null, "A & B < C"], [], ["", "drugi\nwiersz"]] }, { prefixed }));
    const s = wb.sheet("Arkusz")!;
    expect(s.text(1, 1)).toBe("Zażółć gęślą jaźń");
    expect(s.text(1, 2)).toBe("");
    expect(s.text(1, 3)).toBe("A & B < C");
    expect(s.text(3, 2)).toBe("drugi\nwiersz");
    expect(s.maxRow).toBe(3);
  });

  it("czyta rich text, tekst w komórce i liczby", () => {
    const sheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">
      <c r="A1" t="s"><v>0</v></c><c r="B1" t="inlineStr"><is><t>w komórce</t></is></c><c r="C1"><v>42</v></c><c r="D1" t="b"><v>1</v></c>
      </row></sheetData></worksheet>`;
    const data = zipSync({
      "xl/workbook.xml": strToU8(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="S" sheetId="1" r:id="r1"/></sheets></workbook>`),
      "xl/_rels/workbook.xml.rels": strToU8(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Target="worksheets/sheet1.xml"/></Relationships>`),
      "xl/sharedStrings.xml": strToU8(`<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><r><t>pogrubiony </t></r><r><t xml:space="preserve">i zwykły</t></r><rPh><t>wymowa</t></rPh></si></sst>`),
      "xl/worksheets/sheet1.xml": strToU8(sheet),
    });
    const s = readXlsx(data).sheet("S")!;
    expect(s.text(1, 1)).toBe("pogrubiony i zwykły");
    expect(s.text(1, 2)).toBe("w komórce");
    expect(s.text(1, 3)).toBe("42");
    expect(s.text(1, 4)).toBe("TRUE");
  });

  it("odrzuca plik, który nie jest archiwum ZIP", () => {
    expect(() => readXlsx(strToU8("zwykły tekst"))).toThrow(XlsxReadError);
  });

  it("odrzuca archiwum bez xl/workbook.xml", () => {
    expect(() => readXlsx(zipSync({ "a.xml": strToU8("<a/>") }))).toThrow(/brakuje części xl\/workbook\.xml/);
  });

  it("odrzuca XML z deklaracją DOCTYPE (ochrona przed encjami XML)", () => {
    const data = zipSync({ "xl/workbook.xml": strToU8(`<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "aaaa">]><workbook/>`) });
    expect(() => readXlsx(data)).toThrow(/DOCTYPE/);
  });
});
