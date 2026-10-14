import { describe, expect, it } from "vitest";

import { codeKey, mergeReceiptItems, skuFromCode, skuVariants, titleCase } from "@/lib/receipt";

describe("codeKey", () => {
  it("normaliza códigos con ceros y prefijo", () => {
    expect(codeKey("00071")).toBe("71");
    expect(codeKey("NATARG-240651")).toBe("240651");
    expect(codeKey(" 15.826 ")).toBe("15826");
  });
  it("descarta lo que no es código", () => {
    expect(codeKey("")).toBeNull();
    expect(codeKey("abc")).toBeNull();
    expect(codeKey("7")).toBeNull();
  });
});

describe("skuVariants", () => {
  it("incluye las formas con ceros adelante", () => {
    expect(skuVariants("71")).toContain("NATARG-00071");
    expect(skuVariants("71")).toContain("NATARG-71");
    expect(skuVariants("240651")).toEqual(["NATARG-240651"]);
  });
});

describe("skuFromCode", () => {
  it("guarda el código como figura en la boleta", () => {
    expect(skuFromCode("00071")).toBe("NATARG-00071");
    expect(skuFromCode("")).toBeNull();
  });
});

describe("mergeReceiptItems", () => {
  it("suma los renglones repetidos y descarta los inválidos", () => {
    const out = mergeReceiptItems([
      { code: "15826", description: "TOP COAT", quantity: 2, unitPrice: 16700 },
      { code: "015826", description: "TOP COAT 8ML", quantity: 1, unitPrice: null },
      { code: "", description: "Folleto", quantity: 0, unitPrice: null },
      { code: "", description: "Sin código", quantity: 3, unitPrice: -1 },
    ]);
    expect(out).toEqual([
      { code: "15826", description: "TOP COAT", quantity: 3, unitPrice: 16700 },
      { code: "", description: "Sin código", quantity: 3, unitPrice: null },
    ]);
  });
});

describe("titleCase", () => {
  it("pasa a mayúscula inicial", () => {
    expect(titleCase("DES ROLL ON  EKOS")).toBe("Des Roll On Ekos");
  });
});
