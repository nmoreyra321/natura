import { describe, expect, it } from "vitest";

import { runningResult, summarizeMpFees } from "@/lib/mp-fees";

describe("summarizeMpFees", () => {
  it("sin datos no inventa nada", () => {
    const s = summarizeMpFees([{ total: 10000, mp_net_received: null }], 9.5);
    expect(s.count).toBe(0);
    expect(s.feePercent).toBeNull();
    expect(s.suggestedPercent).toBeNull();
  });

  it("gana cuando el recargo cubre la comisión", () => {
    // total 10000 + 9,5 % = 10950; comisión ~7,6 % → llegan 10118
    const s = summarizeMpFees([{ total: 10000, mp_net_received: 10118 }], 9.5);
    expect(s.count).toBe(1);
    expect(s.resultCents).toBe(11800);
    expect(s.shortCount).toBe(0);
  });

  it("pierde cuando llega menos que el pedido y sugiere subir el recargo", () => {
    const s = summarizeMpFees([{ total: 10000, mp_net_received: 9600 }], 5);
    expect(s.resultCents).toBe(-40000);
    expect(s.shortCount).toBe(1);
    expect(s.suggestedPercent).toBeGreaterThan(5);
  });
});

describe("runningResult", () => {
  it("va sumando lo que deja cada pago", () => {
    const rows = runningResult([
      { total: 10000, mp_net_received: 10100 },
      { total: 10000, mp_net_received: 9700 },
      { total: 5000, mp_net_received: null },
    ]);
    expect(rows.map((r) => r.resultCents)).toEqual([10000, -30000]);
    expect(rows.map((r) => r.runningCents)).toEqual([10000, -20000]);
  });
});
