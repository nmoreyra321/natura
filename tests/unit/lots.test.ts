import { describe, expect, it } from "vitest";

import { expiryState, expiryWarningLimit, formatExpiry, monthsLeft, parseExpiry } from "@/lib/lots";

describe("parseExpiry", () => {
  it("toma mes y año como en el envase y vence a fin de mes", () => {
    expect(parseExpiry("01/29")).toBe("2029-01-31");
    expect(parseExpiry("1/29")).toBe("2029-01-31");
    expect(parseExpiry("02-2028")).toBe("2028-02-29");
    expect(parseExpiry("0627")).toBe("2027-06-30");
    expect(parseExpiry(" 11 . 26 ")).toBe("2026-11-30");
  });

  it("rechaza fechas inválidas", () => {
    expect(parseExpiry("13/29")).toBeNull();
    expect(parseExpiry("00/29")).toBeNull();
    expect(parseExpiry("hola")).toBeNull();
    expect(parseExpiry("")).toBeNull();
  });

  it("se muestra igual que en el envase", () => {
    expect(formatExpiry("2029-01-31")).toBe("01/29");
  });
});

describe("lista Por vencer (3 meses)", () => {
  const now = new Date("2026-10-14T15:00:00Z");

  it("calcula el límite a 3 meses", () => {
    expect(expiryWarningLimit(now)).toBe("2027-01-14");
    expect(expiryWarningLimit(new Date("2026-11-30T15:00:00Z"))).toBe("2027-02-28");
  });

  it("clasifica vencidos, por vencer y al día", () => {
    expect(expiryState("2026-09-30", now)).toBe("expired");
    expect(expiryState("2026-10-31", now)).toBe("soon");
    expect(expiryState("2026-12-31", now)).toBe("soon");
    expect(expiryState("2027-01-31", now)).toBe("ok");
    expect(expiryState("2029-01-31", now)).toBe("ok");
  });

  it("cuenta los meses que faltan", () => {
    expect(monthsLeft("2026-10-31", now)).toBe(0);
    expect(monthsLeft("2027-01-31", now)).toBe(3);
  });
});
