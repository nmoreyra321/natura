import { describe, expect, it } from "vitest";

import { isValidProductImagePath, validateImageFile } from "@/lib/images";
import { slugify } from "@/lib/slug";
import { loginIdentifierToEmail, normalizeMpLink, parseMoney, productSchema, socialLinksSchema } from "@/lib/validation";

const base = {
  name: "Crema corporal",
  magazine_price: "25.000",
  sale_price: "21000,50",
  stock: "3",
  status: "draft",
  is_featured: false,
  is_offer: false,
};

describe("parseMoney", () => {
  it("entiende formatos argentinos", () => {
    expect(parseMoney("12.500")).toBe(12500);
    expect(parseMoney("12.500,50")).toBe(12500.5);
    expect(parseMoney("$ 12500")).toBe(12500);
    expect(parseMoney("12500.5")).toBe(12500.5);
    expect(parseMoney("abc")).toBeNaN();
    expect(parseMoney("1,234,5")).toBeNaN();
  });
});

describe("productSchema", () => {
  it("acepta un producto válido", () => {
    const r = productSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.magazine_price).toBe(25000);
      expect(r.data.sale_price).toBe(21000.5);
      expect(r.data.stock).toBe(3);
    }
  });
  it("rechaza precios cero o negativos", () => {
    expect(productSchema.safeParse({ ...base, sale_price: "0" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, magazine_price: "-5" }).success).toBe(false);
  });
  it("rechaza stock negativo o decimal", () => {
    expect(productSchema.safeParse({ ...base, stock: "-1" }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, stock: "1.5" }).success).toBe(false);
  });
  it("no permite ofertas sin descuento real", () => {
    expect(productSchema.safeParse({ ...base, sale_price: "25000", is_offer: true }).success).toBe(false);
    expect(productSchema.safeParse({ ...base, is_offer: true }).success).toBe(true);
  });
  it("valida el slug", () => {
    expect(productSchema.safeParse({ ...base, slug: "Mal Slug!" }).success).toBe(false);
  });
});

describe("slugify", () => {
  it("genera URLs legibles en español", () => {
    expect(slugify("Cuerpo y Baño")).toBe("cuerpo-y-bano");
    expect(slugify("  Ékos Maracujá 150 ml  ")).toBe("ekos-maracuja-150-ml");
  });
});

describe("imágenes", () => {
  it("valida tipo, extensión y tamaño", () => {
    expect(validateImageFile({ name: "a.jpg", type: "image/jpeg", size: 1000 })).toBeNull();
    expect(validateImageFile({ name: "a.gif", type: "image/gif", size: 1000 })).not.toBeNull();
    expect(validateImageFile({ name: "a.png", type: "image/jpeg", size: 1000 })).not.toBeNull();
    expect(validateImageFile({ name: "a.jpg", type: "image/jpeg", size: 6 * 1024 * 1024 })).not.toBeNull();
  });
  it("solo acepta rutas dentro de la carpeta del producto", () => {
    const pid = "11111111-1111-4111-8111-111111111111";
    const other = "22222222-2222-4222-8222-222222222222";
    const file = "33333333-3333-4333-8333-333333333333";
    expect(isValidProductImagePath(`products/${pid}/${file}.webp`, pid)).toBe(true);
    expect(isValidProductImagePath(`products/${other}/${file}.webp`, pid)).toBe(false);
    expect(isValidProductImagePath(`products/${pid}/../x.webp`, pid)).toBe(false);
  });
});

describe("login con usuario o correo", () => {
  it("convierte un nombre de usuario en el correo interno", () => {
    expect(loginIdentifierToEmail(" NatuMariel2026 ")).toBe("natumariel2026@natumariel.vercel.app");
  });
  it("acepta correos reales tal cual", () => {
    expect(loginIdentifierToEmail("Mariel@Gmail.com")).toBe("mariel@gmail.com");
  });
  it("rechaza valores inválidos", () => {
    expect(loginIdentifierToEmail("")).toBeNull();
    expect(loginIdentifierToEmail("ab")).toBeNull();
    expect(loginIdentifierToEmail("con espacio")).toBeNull();
    expect(loginIdentifierToEmail("mal@")).toBeNull();
  });
});

describe("normalizeMpLink", () => {
  it("acepta el link como lo pegue", () => {
    expect(normalizeMpLink("link.mercadopago.com.ar/natumariel")).toBe("https://link.mercadopago.com.ar/natumariel");
    expect(normalizeMpLink(" https://LINK.mercadopago.com.ar/natumariel ")).toBe("https://link.mercadopago.com.ar/natumariel");
    expect(normalizeMpLink("https://mpago.la/2abc3")).toBe("https://mpago.la/2abc3");
  });
  it("vacío es null y otra página no sirve", () => {
    expect(normalizeMpLink("")).toBeNull();
    expect(normalizeMpLink("https://otra-pagina.com/natumariel")).toBe(false);
    expect(normalizeMpLink("link.mercadopago.com.ar/")).toBe(false);
  });
});

describe("socialLinksSchema", () => {
  it("acepta los links como los pegue", () => {
    const r = socialLinksSchema.parse({ facebook: "facebook.com/natumariel", instagram: "" });
    expect(r).toEqual({ facebook: "https://facebook.com/natumariel", instagram: null });
  });
  it("rechaza links de otra página", () => {
    expect(socialLinksSchema.safeParse({ facebook: "https://otra.com/x", instagram: "" }).success).toBe(false);
  });
});
