import { describe, expect, it } from "vitest";

import { cleanSearch, isManualSale, originLabel } from "@/lib/channels";

describe("originLabel", () => {
  it("distingue la tienda de las ventas rápidas", () => {
    expect(originLabel("web")).toBe("Tienda web");
    expect(originLabel(null)).toBe("Tienda web");
    expect(originLabel("facebook")).toBe("Venta rápida · Vivo de Facebook");
    expect(originLabel("raro")).toBe("Venta rápida · Otro");
    expect(isManualSale("presencial")).toBe(true);
  });
});

describe("cleanSearch", () => {
  it("saca caracteres que rompen el filtro", () => {
    expect(cleanSearch(" NM-6B7EA9 ")).toBe("NM-6B7EA9");
    expect(cleanSearch("ana,(lópez)*")).toBe("ana lópez");
  });
});
