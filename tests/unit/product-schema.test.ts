import { describe, expect, it } from "vitest";

import { productSchema } from "@/lib/validation";

const base = {
  name: "Crema de manos",
  slug: "",
  description: "",
  category_id: "",
  size: "",
  line: "",
  natura_sku: "",
  magazine_price: "5",
  sale_price: "3",
  stock: "5",
  status: "published",
  is_featured: false,
  is_offer: false,
  gender: "",
};

describe("productSchema", () => {
  it("acepta lo que ya validó el formulario (el servidor lo revisa de nuevo)", () => {
    const first = productSchema.parse(base);
    const second = productSchema.safeParse(first);
    expect(second.success).toBe(true);
  });

  it("deja vacío el código de Natura y el género", () => {
    const out = productSchema.parse(base);
    expect(out.natura_sku).toBeNull();
    expect(out.gender).toBeNull();
  });

  it("rechaza un código de Natura mal escrito", () => {
    expect(productSchema.safeParse({ ...base, natura_sku: "ABC-1" }).success).toBe(false);
  });
});
