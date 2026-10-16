"use server";

import { after } from "next/server";

import { getProductsForCart } from "@/lib/catalog";
import { formatARS } from "@/lib/format";
import { notifyAdmins } from "@/lib/push";
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

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/**
 * Cómo recibe el pedido. Si es envío, el precio sale de la base (nunca del navegador)
 * según la localidad elegida.
 */
async function deliveryFields(
  admin: Admin,
  d: { deliveryMethod?: "retiro" | "envio"; shippingZoneId?: string; shippingAddress?: string },
): Promise<
  | { ok: true; fields: Record<string, string | number>; costCents: number; zone: string | null }
  | { ok: false; error: string }
> {
  if (d.deliveryMethod !== "envio" || !d.shippingZoneId) return { ok: true, fields: { delivery_method: "retiro" }, costCents: 0, zone: null };
  const { data: zone } = await admin
    .from("shipping_zones")
    .select("name, price")
    .eq("id", d.shippingZoneId)
    .eq("is_active", true)
    .maybeSingle();
  if (!zone) return { ok: false, error: "Esa localidad ya no tiene envío. Elegí otra o retirá en un punto de encuentro." };
  const costCents = toCents(zone.price);
  return {
    ok: true,
    fields: {
      delivery_method: "envio",
      shipping_zone: zone.name,
      shipping_address: d.shippingAddress?.trim() ?? "",
      shipping_cost: costCents / 100,
    },
    costCents,
    zone: zone.name,
  };
}

/**
 * Freno por clienta (no general): si un mismo teléfono ya tiene varios pedidos sin confirmar,
 * no se crean más. Así un molesto no traba las compras de las demás, y una clienta real
 * solo ve el aviso si de verdad tiene muchos pedidos pendientes.
 */
const MAX_PENDING_PER_PHONE = 3;
async function tooManyPending(admin: Admin, phone: string): Promise<boolean> {
  const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_phone", phone)
    .eq("status", "pending")
    .gte("created_at", since);
  return (count ?? 0) >= MAX_PENDING_PER_PHONE;
}
const PENDING_MESSAGE = `Ya tenés ${MAX_PENDING_PER_PHONE} pedidos esperando confirmación. Natu Mariel te va a escribir; si querés sumar o cambiar algo, escribile por WhatsApp.`;

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
  if (await tooManyPending(admin, phone)) return { ok: false, error: PENDING_MESSAGE };
  const delivery = await deliveryFields(admin, parsed.data);
  if (!delivery.ok) return delivery;

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
        ...delivery.fields,
        // El envío va dentro del total: así pagos, deudas y ventas ya lo cuentan.
        ...(delivery.costCents > 0 ? { total: (toCents(row.total) + delivery.costCents) / 100 } : {}),
      })
      .eq("id", row.id)
      .select("code")
      .maybeSingle();
    if (saveError) console.error("[pedido] No se pudo guardar la forma de pago o el teléfono:", saveError.message);
    code = saved?.code ?? null;
  }
  // Aviso al celular de Natu Mariel (después de responder, para no demorar a la clienta).
  after(() =>
    notifyAdmins({
      title: `🛍 Pedido nuevo${parsed.data.isGift ? " 🎁" : ""}`,
      body: `${parsed.data.customerName} · ${formatARS(toCents(row.total) + delivery.costCents)}${parsed.data.paymentMethod === "transferencia" ? " · paga con Mercado Pago (link)" : " · efectivo"}${delivery.zone ? ` · envío a ${delivery.zone}` : ""}`,
      url: code ? `/admin/pedidos?estado=todos&q=${code}` : "/admin/pedidos",
      tag: `pedido-${row.id}`,
    }),
  );
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
  if (await tooManyPending(admin, phone)) return { ok: false, error: PENDING_MESSAGE };
  const delivery = await deliveryFields(admin, parsed.data);
  if (!delivery.ok) return delivery;

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
      .update({
        payment_method: "mercadopago",
        payment_status: "pending",
        customer_phone: phone,
        ...giftFields(parsed.data),
        ...delivery.fields,
        ...(delivery.costCents > 0 ? { total: (toCents(order.total) + delivery.costCents) / 100 } : {}),
      })
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
  if (delivery.costCents > 0) {
    lines.push({ id: "envio", title: `Envío a ${delivery.zone}`, quantity: 1, unitPrice: delivery.costCents / 100 });
  }
  // Recargo por Mercado Pago (lo paga la clienta para cubrir la comisión), sobre productos y envío.
  const surcharge = surchargeCents(toCents(order.total) + delivery.costCents, await getMercadoPagoSurcharge());
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
  after(() =>
    notifyAdmins({
      title: `🛍 Pedido nuevo${parsed.data.isGift ? " 🎁" : ""}`,
      body: `${parsed.data.customerName} · ${formatARS(toCents(order.total) + delivery.costCents)} · paga con Mercado Pago${delivery.zone ? ` · envío a ${delivery.zone}` : ""}`,
      url: "/admin/pedidos",
      tag: `pedido-${order.id}`,
    }),
  );
  return { ok: true, url: preference.url };
}
