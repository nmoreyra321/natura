"use server";

import { getProductsForCart } from "@/lib/catalog";
import { getSiteUrl } from "@/lib/config";
import { createPreference, isMercadoPagoEnabled } from "@/lib/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";
import { surchargeCents, toCents } from "@/lib/pricing";
import { getMercadoPagoSurcharge } from "@/lib/store-settings";
import { toWhatsAppPhone } from "@/lib/debts";
import { allowRequest } from "@/lib/rate-limit";
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

/** Mensaje claro para la clienta cuando el pedido no se pudo crear. */
function orderError(message: string | undefined): string {
  const short = message?.match(/sin stock suficiente: (.+)$/)?.[1];
  if (short) return `Ya no queda stock suficiente de «${short}». Revisá el carrito.`;
  if (message?.includes("demasiados pedidos")) return "Hay muchos pedidos en este momento. Probá de nuevo en un minuto.";
  if (message?.includes("ya no están disponibles")) return "Algún producto del carrito ya no está disponible. Revisá el carrito.";
  return "No pudimos registrar el pedido. Probá de nuevo.";
}

/** «Es para regalo» con su nota (si no es regalo, no se guarda nota). */
function giftFields(d: { isGift?: boolean; giftNote?: string }) {
  return d.isGift ? { is_gift: true, gift_note: d.giftNote?.trim() || null } : {};
}

export type RegisterOrderResult = { ok: true; id: string; code: string | null } | { ok: false; error: string };

/**
 * Registra el pedido para el panel de Mariel justo antes de abrir WhatsApp.
 * La base toma los precios vigentes; el navegador solo indica productos y cantidades.
 */
export async function registerOrder(input: unknown): Promise<RegisterOrderResult> {
  const parsed = orderRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Completá tu nombre y tu WhatsApp para enviar el pedido." };
  const phone = toWhatsAppPhone(parsed.data.customerPhone);
  if (!phone) return { ok: false, error: "Revisá tu número de WhatsApp (por ejemplo 11 2345-6789)." };

  // Los pedidos se crean solo desde acá (con la clave secreta), nunca directo desde el navegador.
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "La tienda no está configurada." };
  if (!(await allowRequest("pedido", 8, 600))) {
    return { ok: false, error: "Hiciste muchos pedidos seguidos. Esperá unos minutos o escribile a Natu Mariel por WhatsApp." };
  }

  const { data, error } = await admin.rpc("create_order", {
    items: parsed.data.items,
    customer_name: parsed.data.customerName,
  });
  const row = data?.[0];
  if (error || !row) {
    console.error("[pedido] No se pudo registrar:", error?.message);
    return { ok: false, error: orderError(error?.message) };
  }
  // El código (al azar) y la forma de pago los maneja el servidor: la clienta no puede leer ni editar pedidos.
  let code: string | null = null;
  {
    const { data: saved, error: saveError } = await admin
      .from("orders")
      .update({
        payment_method: parsed.data.paymentMethod === "transferencia" ? "transferencia" : "efectivo",
        customer_phone: phone,
        ...giftFields(parsed.data),
      })
      .eq("id", row.id)
      .select("code")
      .maybeSingle();
    if (saveError) console.error("[pedido] No se pudo guardar la forma de pago o el teléfono:", saveError.message);
    code = saved?.code ?? null;
  }
  return { ok: true, id: row.id, code };
}

export type MercadoPagoCheckoutResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Registra el pedido como "Mercado Pago" y devuelve el link para pagar.
 * Los precios salen del pedido guardado en la base, no del navegador.
 */
export async function payWithMercadoPago(input: unknown): Promise<MercadoPagoCheckoutResult> {
  if (!isMercadoPagoEnabled()) return { ok: false, error: "El pago con Mercado Pago no está disponible." };
  const parsed = orderRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Completá tu nombre y tu WhatsApp para pagar." };
  const phone = toWhatsAppPhone(parsed.data.customerPhone);
  if (!phone) return { ok: false, error: "Revisá tu número de WhatsApp (por ejemplo 11 2345-6789)." };

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "La tienda no está configurada para cobrar online." };
  if (!(await allowRequest("pedido", 8, 600))) {
    return { ok: false, error: "Hiciste muchos pedidos seguidos. Esperá unos minutos o escribile a Natu Mariel por WhatsApp." };
  }

  const { data, error } = await admin.rpc("create_order", {
    items: parsed.data.items,
    customer_name: parsed.data.customerName,
  });
  const order = data?.[0];
  if (error || !order) {
    console.error("[pedido] No se pudo registrar:", error?.message);
    return { ok: false, error: orderError(error?.message) };
  }

  const [{ error: markError }, { data: items }] = await Promise.all([
    admin
      .from("orders")
      .update({ payment_method: "mercadopago", payment_status: "pending", customer_phone: phone, ...giftFields(parsed.data) })
      .eq("id", order.id),
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
  return { ok: true, url: preference.url };
}
