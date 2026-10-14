import { describe, expect, it } from "vitest";

import {
  currentMonth,
  localDay,
  monthLabel,
  monthStartIso,
  monthlyTotals,
  percentChange,
  recentDays,
  shiftDay,
  shiftMonth,
  summarizeMonth,
  type SalesOrder,
} from "@/lib/sales";

const order = (status: string, created_at: string, total: number, items: SalesOrder["items"] = []): SalesOrder => ({
  status,
  total,
  savings: 0,
  created_at,
  items,
});

describe("fechas en hora de Argentina", () => {
  it("un pedido a las 23:30 del 31/10 en Argentina cuenta en octubre", () => {
    expect(localDay("2026-11-01T02:30:00Z")).toBe("2026-10-31");
    expect(monthStartIso("2026-11")).toBe("2026-11-01T03:00:00.000Z");
  });

  it("cambia de mes y de año", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(currentMonth(new Date("2026-11-01T02:00:00Z"))).toBe("2026-10");
    expect(monthLabel("2026-10")).toBe("Octubre de 2026");
  });
});

describe("summarizeMonth", () => {
  const orders = [
    order("confirmed", "2026-10-02T15:00:00Z", 10000, [
      { product_id: "a", name: "Crema", quantity: 2, unit_price: 3000 },
      { product_id: "b", name: "Perfume", quantity: 1, unit_price: 4000 },
    ]),
    order("delivered", "2026-10-02T18:00:00Z", 5000, [{ product_id: "b", name: "Perfume", quantity: 1, unit_price: 5000 }]),
    order("pending", "2026-10-05T12:00:00Z", 7000),
    order("cancelled", "2026-10-06T12:00:00Z", 9000),
    order("confirmed", "2026-09-30T12:00:00Z", 1000),
  ];

  it("suma solo confirmados y entregados del mes", () => {
    const s = summarizeMonth(orders, "2026-10");
    expect(s.totalCents).toBe(1_500_000);
    expect(s.orders).toBe(2);
    expect(s.units).toBe(4);
    expect(s.averageCents).toBe(750_000);
    expect(s.pendingCents).toBe(700_000);
    expect(s.pendingOrders).toBe(1);
    expect(s.cancelledOrders).toBe(1);
    expect(s.byDayCents).toHaveLength(31);
    expect(s.byDayCents[1]).toBe(1_500_000);
  });

  it("ordena los productos por lo vendido", () => {
    const s = summarizeMonth(orders, "2026-10");
    expect(s.topProducts.map((p) => [p.name, p.units, p.totalCents])).toEqual([
      ["Perfume", 2, 900_000],
      ["Crema", 2, 600_000],
    ]);
  });

  it("agrupa por mes los últimos meses", () => {
    expect(monthlyTotals(orders, "2026-10", 2)).toEqual([
      { month: "2026-09", totalCents: 100_000 },
      { month: "2026-10", totalCents: 1_500_000 },
    ]);
  });
});

describe("percentChange", () => {
  it("calcula la variación y no divide por cero", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe("recentDays", () => {
  it("suma las ventas de cada día (hora de Argentina) y no cuenta pendientes ni cancelados", () => {
    const orders = [
      { status: "confirmed", total: 1000, savings: 0, created_at: "2026-10-14T15:00:00Z", items: [] },
      { status: "delivered", total: 500, savings: 0, created_at: "2026-10-14T02:00:00Z", items: [] }, // 13/10 23 h en Argentina
      { status: "pending", total: 999, savings: 0, created_at: "2026-10-14T15:00:00Z", items: [] },
      { status: "cancelled", total: 999, savings: 0, created_at: "2026-10-14T15:00:00Z", items: [] },
    ];
    const days = recentDays(orders, "2026-10-14", 3);
    expect(days.map((d) => d.day)).toEqual(["2026-10-12", "2026-10-13", "2026-10-14"]);
    expect(days.map((d) => d.cents)).toEqual([0, 50000, 100000]);
    expect(days[2].orders).toBe(1);
  });
});

describe("shiftDay", () => {
  it("cruza meses", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
  });
});
