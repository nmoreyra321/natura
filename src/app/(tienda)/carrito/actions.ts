"use server";

import { getProductsForCart } from "@/lib/catalog";
import { toCents } from "@/lib/pricing";
import { cartRequestSchema } from "@/lib/validation";

export type CartValidationLine = {
  productId: string;
  name: string;
  slug: string;
  size: string | null;
  image: string | null;
  salePrice: number;
  magazinePrice: number;
  stock: number;
};

export type CartValidationResult =
  | { ok: true; products: CartValidationLine[]; missing: string[] }
  | { ok: false; error: string };

/**
 * Revalida el carrito contra la base de datos: precios vigentes, stock y productos
 * que ya no están publicados. No reserva stock ni confirma ningún pedido.
 */
export async function validateCart(input: unknown): Promise<CartValidationResult> {
  const parsed = cartRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "El carrito tiene datos inválidos." };

  const ids = [...new Set(parsed.data.map((i) => i.productId))];
  const rows = await getProductsForCart(ids);
  if (!rows) {
    return { ok: false, error: "No pudimos verificar precios y stock. Probá de nuevo en un rato." };
  }

  const found = new Set(rows.map((r) => r.id));
  return {
    ok: true,
    products: rows.map((r) => ({
      productId: r.id,
      name: r.name,
      slug: r.slug,
      size: r.size,
      image: r.image,
      salePrice: toCents(r.sale_price) / 100,
      magazinePrice: toCents(r.magazine_price) / 100,
      stock: r.stock,
    })),
    missing: ids.filter((id) => !found.has(id)),
  };
}
