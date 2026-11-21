import { describe, expect, it } from "vitest";
import { availableAdditionalCriteria, mandatoryCriteria, validateAdditionalCriteria } from "@/lib/rules/kryteria";

describe("kryteria obowiązkowe (§ 4)", () => {
  it("arkusz C i B mają po 5 kryteriów, A ma 6", () => {
    expect(mandatoryCriteria("C")).toEqual(["WIEDZA", "RZETELNOSC", "ORGANIZACJA", "WSPOLPRACA", "KOMUNIKACJA"]);
    expect(mandatoryCriteria("B")).toHaveLength(5);
    expect(mandatoryCriteria("A")).toContain("STRATEGICZNE");
  });

  it("lista dostępnych dodatkowych nie zawiera obowiązkowych", () => {
    const dostepne = availableAdditionalCriteria("C");
    expect(dostepne).toHaveLength(9);
    expect(dostepne).not.toContain("RZETELNOSC");
    expect(dostepne).toContain("LUDZIE");
  });
});

describe("walidacja kryteriów dodatkowych (§ 5 ust. 2)", () => {
  it("0–3 poprawne kryteria są dopuszczalne", () => {
    expect(validateAdditionalCriteria("C", [])).toEqual({ valid: true, errors: [] });
    expect(validateAdditionalCriteria("C", ["ANALITYCZNE", "KLIENT", "KREATYWNOSC"]).valid).toBe(true);
  });

  it("4. kryterium dodatkowe zostaje odrzucone", () => {
    const w = validateAdditionalCriteria("C", ["ANALITYCZNE", "KLIENT", "KREATYWNOSC", "NEGOCJOWANIE"]);
    expect(w.valid).toBe(false);
    expect(w.errors).toHaveLength(1);
    expect(w.errors[0].legalBasis).toBe("§ 5 ust. 2");
    expect(w.errors[0].text).toContain("Wybrano 4 kryteria dodatkowe, a można najwyżej 3");
  });

  it("kryterium dodatkowe takie samo jak obowiązkowe zostaje odrzucone", () => {
    const w = validateAdditionalCriteria("C", ["RZETELNOSC"]);
    expect(w.valid).toBe(false);
    expect(w.errors[0].text).toContain("„Rzetelność” jest już kryterium obowiązkowym");
    expect(w.errors[0].legalBasis).toBe("§ 4");
  });

  it("to samo kryterium jest obowiązkowe w B, ale może być dodatkowe w C", () => {
    expect(validateAdditionalCriteria("B", ["LUDZIE"]).valid).toBe(false);
    expect(validateAdditionalCriteria("C", ["LUDZIE"]).valid).toBe(true);
  });

  it("odrzuca powtórzenia i kody spoza wykazu", () => {
    const powtorzenie = validateAdditionalCriteria("C", ["KLIENT", "KLIENT"]);
    expect(powtorzenie.valid).toBe(false);
    expect(powtorzenie.errors[0].text).toContain("wybrano więcej niż raz");

    const nieznane = validateAdditionalCriteria("C", ["INNE"]);
    expect(nieznane.valid).toBe(false);
    expect(nieznane.errors[0].legalBasis).toBe("§ 2 ust. 3");
  });
});
