"use server";

import { getProductsForCart } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/config";
import { createPreference, isMercadoPagoEnabled } from "@/lib/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import { createPublicClient } from "@/lib/supabase/server";
import { surchargeCents, toCents } from "@/lib/pricing";
import { getMercadoPagoSurcharge } from "@/lib/store-settings";
import { cartRequestSchema, orderRequestSchema } from "@/lib/validation";

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

export type RegisterOrderResult = { ok: true; number: number } | { ok: false; error: string };

/**
 * Registra el pedido para el panel de Mariel justo antes de abrir WhatsApp.
 * La base toma los precios vigentes; el navegador solo indica productos y cantidades.
 */
export async function registerOrder(input: unknown): Promise<RegisterOrderResult> {
  const parsed = orderRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "El pedido tiene datos inválidos." };

  const supabase = createPublicClient({ cached: false });
  if (!supabase) return { ok: false, error: "La tienda no está configurada." };

  const { data, error } = await supabase.rpc("create_order", {
    items: parsed.data.items,
    customer_name: parsed.data.customerName || undefined,
  });
  const row = data?.[0];
  if (error || !row) {
    console.error("[pedido] No se pudo registrar:", error?.message);
    return { ok: false, error: "No pudimos registrar el pedido." };
  }
  if (parsed.data.paymentMethod === "transferencia") {
    // Lo anota el servidor (la clienta no puede editar pedidos). Si falla, el pedido igual queda.
    await createAdminClient()?.from("orders").update({ payment_method: "transferencia" }).eq("id", row.id);
  }
  return { ok: true, number: row.number };
}

export type MercadoPagoCheckoutResult = { ok: true; url: string; number: number } | { ok: false; error: string };

/**
 * Registra el pedido como "Mercado Pago" y devuelve el link para pagar.
 * Los precios salen del pedido guardado en la base, no del navegador.
 */
export async function payWithMercadoPago(input: unknown): Promise<MercadoPagoCheckoutResult> {
  if (!isMercadoPagoEnabled()) return { ok: false, error: "El pago con Mercado Pago no está disponible." };
  const parsed = orderRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "El pedido tiene datos inválidos." };

  const supabase = createPublicClient({ cached: false });
  const admin = createAdminClient();
  if (!supabase || !admin) return { ok: false, error: "La tienda no está configurada para cobrar online." };

  const { data, error } = await supabase.rpc("create_order", {
    items: parsed.data.items,
    customer_name: parsed.data.customerName || undefined,
  });
  const order = data?.[0];
  if (error || !order) {
    console.error("[pedido] No se pudo registrar:", error?.message);
    return { ok: false, error: "No pudimos registrar el pedido." };
  }

  const [{ error: markError }, { data: items }] = await Promise.all([
    admin.from("orders").update({ payment_method: "mercadopago", payment_status: "pending" }).eq("id", order.id),
    admin.from("order_items").select("product_id, name, size, quantity, unit_price").eq("order_id", order.id),
  ]);
  if (markError || !items || items.length === 0) {
    console.error("[pedido] No se pudo preparar el pago:", markError?.message);
    return { ok: false, error: "No pudimos preparar el pago. Probá de nuevo." };
  }

  const lines = items.map((i) => ({
    id: i.product_id ?? i.name,
    title: i.size ? `${i.name} (${i.size})` : i.name,
    quantity: i.quantity,
    unitPrice: toCents(i.unit_price) / 100,
  }));
  // Recargo por Mercado Pago (lo paga la clienta para cubrir la comisión).
  const surcharge = surchargeCents(toCents(order.total), await getMercadoPagoSurcharge());
  if (surcharge > 0) {
    lines.push({ id: "recargo-mp", title: "Recargo por pago con Mercado Pago", quantity: 1, unitPrice: surcharge / 100 });
  }

  const preference = await createPreference({
    orderId: order.id,
    orderNumber: order.number,
    siteUrl: getSiteUrl(),
    items: lines,
  });
  if (!preference) {
    // El pedido no sirve sin link de pago: lo dejamos cancelado para que no confunda en el panel.
    await admin.from("orders").update({ status: "cancelled", payment_status: "cancelled" }).eq("id", order.id);
    return { ok: false, error: "Mercado Pago no respondió. Probá de nuevo en un rato o elegí efectivo." };
  }
  return { ok: true, url: preference.url, number: order.number };
}
