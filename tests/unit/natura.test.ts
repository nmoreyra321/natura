import { describe, expect, it } from "vitest";

import { parseNaturaMagazinePrice } from "@/lib/natura";

/** Arma una página con el mismo formato que usa naturacosmeticos.com.ar. */
function page(price: unknown): string {
  const flight = `6:["$","$L42",null,{"initialData":${JSON.stringify({
    productId: "NATARG-1",
    name: "Crema \"Ekos\" {especial}",
    price,
    images: ["https://example.com/a.jpg"],
  })}}]`;
  const chunks = [flight.slice(0, 40), flight.slice(40)];
  return chunks.map((c) => `<script>self.__next_f.push([1,${JSON.stringify(c)}])</script>`).join("");
}

describe("parseNaturaMagazinePrice", () => {
  it("usa el precio de lista cuando el producto está en promoción", () => {
    expect(parseNaturaMagazinePrice(page({ sales: { value: 5300 }, list: { value: 10600 } }))).toBe(10600);
  });

  it("usa el precio de venta cuando no hay descuento", () => {
    expect(parseNaturaMagazinePrice(page({ sales: { value: 16300 }, list: null }))).toBe(16300);
  });

  it("devuelve null si la página no trae el producto o el precio", () => {
    expect(parseNaturaMagazinePrice("<html>Access Denied</html>")).toBeNull();
    expect(parseNaturaMagazinePrice(page({ sales: null, list: null }))).toBeNull();
  });
});
