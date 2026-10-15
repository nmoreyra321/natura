import { describe, expect, it } from "vitest";

import { reorderText, salesPeriodText, suggestReorder } from "@/lib/reorder";

describe("suggestReorder", () => {
  it("el doble de semanas pide el doble", () => {
    // Tienda con una semana de ventas: vendió 4.
    const item = { id: "a", name: "Body splash", stock: 0, sold: 4 };
    expect(suggestReorder([item], 1, 7)[0].order).toBe(4);
    expect(suggestReorder([item], 2, 7)[0].order).toBe(8);
    expect(suggestReorder([item], 8, 7)[0].order).toBe(32);
  });

  it("resta lo que queda y redondea para arriba", () => {
    // 4 vendidos en 14 días = 2 por semana; para 4 semanas son 8; con 3 en stock, pedí 5.
    const [s] = suggestReorder([{ id: "a", name: "Crema", stock: 3, sold: 4 }], 4, 14);
    expect(s.need).toBe(8);
    expect(s.order).toBe(5);
    // 1 vendido en 3 meses: para 1 semana hace falta 1 (nunca medio producto).
    expect(suggestReorder([{ id: "b", name: "Kaiak", stock: 0, sold: 1 }], 1)[0].need).toBe(1);
  });

  it("no sugiere nada si el stock alcanza o si no se vendió", () => {
    expect(suggestReorder([{ id: "a", name: "Crema", stock: 10, sold: 9 }], 4)).toEqual([]);
    expect(suggestReorder([{ id: "b", name: "Kaiak", stock: 0, sold: 0 }], 4)).toEqual([]);
  });

  it("primero lo agotado", () => {
    const list = suggestReorder(
      [
        { id: "a", name: "Queda poco", stock: 1, sold: 9 },
        { id: "b", name: "Agotado", stock: 0, sold: 2 },
      ],
      4,
      7,
    );
    expect(list.map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("salesPeriodText", () => {
  it("dice el período en palabras", () => {
    expect(salesPeriodText(7)).toBe("la última semana");
    expect(salesPeriodText(14)).toBe("las últimas 2 semanas");
    expect(salesPeriodText(12)).toBe("los últimos 12 días");
    expect(salesPeriodText(90)).toBe("los últimos 3 meses");
  });
});

describe("reorderText", () => {
  it("arma la lista para copiar", () => {
    expect(reorderText([{ name: "Body splash Frutas Rojas", order: 4, sku: "NATARG-72197" }])).toBe(
      "Pedido Natura:\n• 4 × Body splash Frutas Rojas (cód. 72197)",
    );
  });
});
