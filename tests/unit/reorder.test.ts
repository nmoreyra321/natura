import { describe, expect, it } from "vitest";

import { reorderText, suggestReorder } from "@/lib/reorder";

const base = { waiting: 0 };

describe("suggestReorder", () => {
  it("pide lo que falta para cubrir un mes de ventas", () => {
    // 15 vendidos en 90 días = 5 por mes; con 2 en stock faltan 3.
    const [s] = suggestReorder([{ ...base, id: "a", name: "Body splash", stock: 2, sold: 15 }]);
    expect(s.order).toBe(3);
    expect(s.perMonth).toBe(5);
    expect(s.daysLeft).toBe(12);
  });

  it("no sugiere nada si el stock alcanza", () => {
    expect(suggestReorder([{ ...base, id: "a", name: "Crema", stock: 10, sold: 9 }])).toEqual([]);
  });

  it("cubre a las clientas que esperan aunque no haya ventas", () => {
    const [s] = suggestReorder([{ id: "a", name: "Kaiak", stock: 0, sold: 0, waiting: 2 }]);
    expect(s.order).toBe(2);
    expect(s.daysLeft).toBeNull();
  });

  it("ordena por lo más urgente y respeta las semanas elegidas", () => {
    const list = suggestReorder(
      [
        { ...base, id: "a", name: "Lento", stock: 3, sold: 9 },
        { ...base, id: "b", name: "Agotado", stock: 0, sold: 9 },
      ],
      60,
    );
    expect(list.map((s) => s.id)).toEqual(["b", "a"]);
    expect(list[0].order).toBe(6);
  });
});

describe("reorderText", () => {
  it("arma la lista para copiar", () => {
    expect(reorderText([{ name: "Body splash Frutas Rojas", order: 4, sku: "NATARG-72197" }])).toBe(
      "Pedido Natura:\n• 4 × Body splash Frutas Rojas (cód. 72197)",
    );
  });
});
