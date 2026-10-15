import { describe, expect, it } from "vitest";

import { reorderText, suggestReorder, weeksText } from "@/lib/reorder";

describe("suggestReorder", () => {
  it("pide lo que se vendió menos lo que queda", () => {
    // En las últimas semanas vendiste 4 y te queda 1 → pedí 3.
    const [s] = suggestReorder([{ id: "a", name: "Body splash", stock: 1, sold: 4 }]);
    expect(s.need).toBe(4);
    expect(s.order).toBe(3);
  });

  it("no sugiere nada si el stock alcanza o si no se vendió", () => {
    expect(suggestReorder([{ id: "a", name: "Crema", stock: 10, sold: 9 }])).toEqual([]);
    expect(suggestReorder([{ id: "b", name: "Kaiak", stock: 0, sold: 0 }])).toEqual([]);
  });

  it("primero lo agotado", () => {
    const list = suggestReorder([
      { id: "a", name: "Queda poco", stock: 1, sold: 9 },
      { id: "b", name: "Agotado", stock: 0, sold: 2 },
    ]);
    expect(list.map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("weeksText", () => {
  it("dice el periodo en palabras", () => {
    expect(weeksText(1, "pasadas")).toBe("la última semana");
    expect(weeksText(2, "pasadas")).toBe("las últimas 2 semanas");
    expect(weeksText(4, "proximas")).toBe("las próximas 4 semanas");
  });
});

describe("reorderText", () => {
  it("arma la lista para copiar", () => {
    expect(reorderText([{ name: "Body splash Frutas Rojas", order: 4, sku: "NATARG-72197" }])).toBe(
      "Pedido Natura:\n• 4 × Body splash Frutas Rojas (cód. 72197)",
    );
  });
});
