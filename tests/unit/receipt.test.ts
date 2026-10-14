import { describe, expect, it } from "vitest";

import { aliasKey, cleanInvoiceNumber, codeKey, mergeReceiptItems, parseArDate, skuFromCode, titleCase } from "@/lib/receipt";

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
      { code: "15826", description: "TOP COAT", quantity: 3, unitPrice: 16700, kit: "" },
      { code: "", description: "Sin código", quantity: 3, unitPrice: null, kit: "" },
    ]);
  });
  it("suma el mismo producto que vino en cajas distintas y recuerda la primera caja", () => {
    const out = mergeReceiptItems([
      { code: "", description: "TODODIA HID DES FRU V 400ML", quantity: 3, unitPrice: null, kit: "TD CJ FRUTAS ROJAS CP" },
      { code: "", description: "TODODIA HID DES FRU V 400ML", quantity: 1, unitPrice: null, kit: "TD CJ FRUTAS ROJAS EXC" },
    ]);
    expect(out).toEqual([
      { code: "", description: "TODODIA HID DES FRU V 400ML", quantity: 4, unitPrice: null, kit: "TD CJ FRUTAS ROJAS CP" },
    ]);
  });
});

describe("titleCase", () => {
  it("pasa a mayúscula inicial", () => {
    expect(titleCase("DES ROLL ON  EKOS")).toBe("Des Roll On Ekos");
  });
});

describe("aliasKey", () => {
  it("normaliza la descripción para reconocerla la próxima vez", () => {
    expect(aliasKey("  Tododia  hid des fru v 400ml ")).toBe("TODODIA HID DES FRU V 400ML");
    expect(aliasKey("x".repeat(200))).toHaveLength(160);
  });
});

describe("parseArDate", () => {
  it("lee fechas argentinas", () => {
    expect(parseArDate("22/02/2026")).toBe("2026-02-22");
    expect(parseArDate("Fecha VTO: 28-02-26")).toBe("2026-02-28");
  });
  it("descarta fechas imposibles", () => {
    expect(parseArDate("31/02/2026")).toBeNull();
    expect(parseArDate("")).toBeNull();
  });
});

describe("cleanInvoiceNumber", () => {
  it("limpia el número de factura", () => {
    expect(cleanInvoiceNumber(" N° 0028-32433058 ")).toBe("0028-32433058");
    expect(cleanInvoiceNumber("")).toBeNull();
  });
});
