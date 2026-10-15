import { describe, expect, it } from "vitest";

import { reorderText, salesPeriodText, suggestReorder } from "@/lib/reorder";

describe("suggestReorder", () => {
  it("pide lo que falta para cubrir un mes de ventas, en números enteros", () => {
    // 15 vendidos en 90 días → para 30 días hacen falta 5; con 2 en stock, pedí 3.
    const [s] = suggestReorder([{ id: "a", name: "Body splash", stock: 2, sold: 15 }]);
    expect(s.need).toBe(5);
    expect(s.order).toBe(3);
  });

  it("redondea para arriba (nunca medio producto)", () => {
    // 4 vendidos en 14 días → para 30 días son 8,57 → 9.
    const [s] = suggestReorder([{ id: "a", name: "Crema", stock: 0, sold: 4 }], 30, 14);
    expect(s.need).toBe(9);
    expect(Number.isInteger(s.order)).toBe(true);
  });

  it("no sugiere nada si el stock alcanza o si no se vendió", () => {
    expect(suggestReorder([{ id: "a", name: "Crema", stock: 10, sold: 9 }])).toEqual([]);
    expect(suggestReorder([{ id: "b", name: "Kaiak", stock: 0, sold: 0 }])).toEqual([]);
  });

  it("primero lo agotado y respeta las semanas elegidas", () => {
    const list = suggestReorder(
      [
        { id: "a", name: "Lento", stock: 3, sold: 9 },
        { id: "b", name: "Agotado", stock: 0, sold: 9 },
      ],
      60,
    );
    expect(list.map((s) => s.id)).toEqual(["b", "a"]);
    expect(list[0].order).toBe(6);
  });
});

describe("salesPeriodText", () => {
  it("dice el periodo en palabras", () => {
    expect(salesPeriodText(90)).toBe("los últimos 3 meses");
    expect(salesPeriodText(12)).toBe("los últimos 12 días");
  });
});

describe("reorderText", () => {
  it("arma la lista para copiar", () => {
    expect(reorderText([{ name: "Body splash Frutas Rojas", order: 4, sku: "NATARG-72197" }])).toBe(
      "Pedido Natura:\n• 4 × Body splash Frutas Rojas (cód. 72197)",
    );
  });
});
