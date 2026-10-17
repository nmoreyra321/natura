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
import { shippingCostCents } from "@/lib/delivery";
import { getShippingMinTotal } from "@/lib/shipping";
import { getCustomer } from "@/lib/customer";
import { createSessionClient } from "@/lib/supabase/server";
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
    return { ok: false, error: "No pudimos verificar precios y disponibilidad. Probá de nuevo en un rato." };
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
  if (short) return `Ya no quedan unidades suficientes de «${short}». Revisá el carrito.`;
  if (message?.includes("demasiados pedidos")) return "Hay muchos pedidos en este momento. Probá de nuevo en un minuto.";
  if (message?.includes("ya no están disponibles")) return "Algún producto del carrito ya no está disponible. Revisá el carrito.";
  return "No pudimos registrar el pedido. Probá de nuevo.";
}

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

type DeliveryInput = { items: { productId: string; quantity: number }[]; deliveryMethod?: "retiro" | "envio"; shippingZoneId?: string };
type Delivery = { zone: { name: string; percent: number } | null; address: string | null };

/**
 * Cómo recibe el pedido. Si es envío, la localidad y su % salen de la base (nunca del navegador),
 * y solo se acepta si la compra llega al mínimo para envíos.
 */
async function resolveDelivery(
  admin: Admin,
  d: DeliveryInput & { shippingAddress?: string },
): Promise<{ ok: true; delivery: Delivery } | { ok: false; error: string }> {
  if (d.deliveryMethod !== "envio" || !d.shippingZoneId) return { ok: true, delivery: { zone: null, address: null } };
  const [{ data: zone }, minTotal, products] = await Promise.all([
    admin.from("shipping_zones").select("name, percent").eq("id", d.shippingZoneId).eq("is_active", true).maybeSingle(),
    getShippingMinTotal(),
    getProductsForCart([...new Set(d.items.map((i) => i.productId))]),
  ]);
  if (!zone) return { ok: false, error: "Esa localidad ya no tiene envío. Elegí otra o retirá en un punto de encuentro." };
  const prices = new Map((products ?? []).map((p) => [p.id, toCents(p.sale_price)]));
  const productsCents = d.items.reduce((sum, i) => sum + (prices.get(i.productId) ?? 0) * i.quantity, 0);
  const minCents = Math.round(minTotal * 100);
  if (productsCents < minCents) {
    return { ok: false, error: `El envío a domicilio es para compras desde ${formatARS(minCents)}. Elegí punto de encuentro o sumá productos.` };
  }
  return { ok: true, delivery: { zone: { name: zone.name, percent: Number(zone.percent) }, address: d.shippingAddress?.trim() ?? "" } };
}

/** Datos del envío para guardar en el pedido, con el costo calculado sobre el total real de productos. */
function deliveryFields(delivery: Delivery, productsTotal: number | string) {
  if (!delivery.zone) return { costCents: 0, fields: { delivery_method: "retiro" } };
  const productsCents = toCents(productsTotal);
  const costCents = shippingCostCents(productsCents, delivery.zone.percent);
  return {
    costCents,
    fields: {
      delivery_method: "envio",
      shipping_zone: delivery.zone.name,
      shipping_address: delivery.address ?? "",
      shipping_cost: costCents / 100,
      // El envío va dentro del total: así pagos, deudas y ventas ya lo cuentan.
      total: (productsCents + costCents) / 100,
    },
  };
}

/**
 * Si compra con su cuenta: el pedido queda unido a la cuenta (suma al Club) y usa el WhatsApp
 * de la cuenta. Si la cuenta todavía no tenía WhatsApp, se le guarda el de este pedido.
 */
async function accountFields(name: string, phone: string): Promise<{ phone: string; fields: { customer_user_id?: string } }> {
  const customer = await getCustomer();
  if (!customer) return { phone, fields: {} };
  if (!customer.phone) {
    const supabase = await createSessionClient();
    await supabase
      ?.from("customers")
      .upsert({ user_id: customer.id, name: customer.name ?? name, phone }, { onConflict: "user_id" });
  }
  return { phone: customer.phone ?? phone, fields: { customer_user_id: customer.id } };
}

/**
 * Freno por clienta (no general): si un mismo teléfono ya tiene varios pedidos sin confirmar,
 * no se crean más. Así un molesto no traba las compras de las demás, y una clienta real
 * solo ve el aviso si de verdad tiene muchos pedidos pendientes.
 */
const MAX_PENDING_PER_PHONE = 6;
const PENDING_WINDOW_HOURS = 3;
async function tooManyPending(admin: Admin, phone: string): Promise<boolean> {
  const since = new Date(Date.now() - PENDING_WINDOW_HOURS * 3600 * 1000).toISOString();
  const { count } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("customer_phone", phone)
    .eq("status", "pending")
    // Los de Mercado Pago que nunca se pagaron se cierran solos al hacer uno nuevo: no cuentan para el límite.
    .or("payment_method.neq.mercadopago,mp_payment_id.not.is.null")
    .gte("created_at", since);
  return (count ?? 0) >= MAX_PENDING_PER_PHONE;
}
/** Cierra los pedidos de Mercado Pago que esta clienta empezó y nunca pagó (ya armó uno nuevo). */
async function closeAbandonedMercadoPago(admin: Admin, phone: string, keepOrderId: string) {
  const { error } = await admin
    .from("orders")
    .update({ status: "cancelled", payment_status: "cancelled" })
    .eq("customer_phone", phone)
    .eq("status", "pending")
    .eq("payment_method", "mercadopago")
    .eq("stock_applied", false)
    .is("mp_payment_id", null)
    .neq("id", keepOrderId);
  if (error) console.error("[pedido] No se pudieron cerrar los pedidos sin pagar:", error.message);
}
const PENDING_MESSAGE = `Ya tenés ${MAX_PENDING_PER_PHONE} pedidos esperando confirmación. Podés cancelar alguno y hacer uno completo, o escribirle a Natu Mariel por WhatsApp para sumarle productos. En unas horas vas a poder pedir de nuevo.`;

export type RegisterOrderResult =
  | { ok: true; id: string; code: string | null }
  | { ok: false; error: string; pendingLimit?: boolean };

/**
 * Registra el pedido para el panel de Mariel justo antes de abrir WhatsApp.
 * La base toma los precios vigentes; el navegador solo indica productos y cantidades.
 */
export async function registerOrder(input: unknown): Promise<RegisterOrderResult> {
  const parsed = orderRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Completá tu nombre y tu WhatsApp para enviar el pedido." };
  const typedPhone = toWhatsAppPhone(parsed.data.customerPhone);
  if (!typedPhone) return { ok: false, error: "Revisá tu número de WhatsApp (por ejemplo 11 2345-6789)." };
  const account = await accountFields(parsed.data.customerName, typedPhone);
  const phone = account.phone;

  // Los pedidos se crean solo desde acá (con la clave secreta), nunca directo desde el navegador.
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "La tienda no está configurada." };
  if (!(await allowRequest("pedido", 8, 600))) {
    return { ok: false, error: "Hiciste muchos pedidos seguidos. Esperá unos minutos o escribile a Natu Mariel por WhatsApp." };
  }
  if (await tooManyPending(admin, phone)) return { ok: false, error: PENDING_MESSAGE, pendingLimit: true };
  const resolved = await resolveDelivery(admin, parsed.data);
  if (!resolved.ok) return resolved;
  const zoneName = resolved.delivery.zone?.name ?? null;

  const { data, error } = await admin.rpc("create_order", {
    items: parsed.data.items,
    customer_name: parsed.data.customerName,
  });
  const row = data?.[0];
  if (error || !row) {
    console.error("[pedido] No se pudo registrar:", error?.message);
    return { ok: false, error: orderError(error?.message) };
  }
  const delivery = deliveryFields(resolved.delivery, row.total);
  // El código (al azar) y la forma de pago los maneja el servidor: la clienta no puede leer ni editar pedidos.
  const { data: saved, error: saveError } = await admin
    .from("orders")
    .update({
      payment_method: parsed.data.paymentMethod === "transferencia" ? "transferencia" : "efectivo",
      customer_phone: phone,
      ...delivery.fields,
      ...account.fields,
    })
    .eq("id", row.id)
    .select("code")
    .maybeSingle();
  if (saveError || !saved) {
    // Sin esos datos el pedido quedaría a medias (sin teléfono ni envío): se cancela y se le avisa.
    console.error("[pedido] No se pudo guardar el pedido completo:", saveError?.message);
    await admin.from("orders").update({ status: "cancelled" }).eq("id", row.id);
    return { ok: false, error: "No pudimos registrar el pedido. Probá de nuevo." };
  }
  const code: string | null = saved.code ?? null;
  // Aviso al celular de Natu Mariel (después de responder, para no demorar a la clienta).
  after(() =>
    notifyAdmins({
      title: "🛍 Pedido nuevo",
      body: `${parsed.data.customerName} · ${formatARS(toCents(row.total) + delivery.costCents)}${parsed.data.paymentMethod === "transferencia" ? " · paga con Mercado Pago (link)" : " · efectivo"}${zoneName ? ` · envío a ${zoneName}` : ""}`,
      url: code ? `/admin/pedidos?estado=todos&q=${code}` : "/admin/pedidos",
      tag: `pedido-${row.id}`,
    }),
  );
  return { ok: true, id: row.id, code };
}

export type MercadoPagoCheckoutResult = { ok: true; url: string } | { ok: false; error: string; pendingLimit?: boolean };

/**
 * Registra el pedido como "Mercado Pago" y devuelve el link para pagar.
 * Los precios salen del pedido guardado en la base, no del navegador.
 */
export async function payWithMercadoPago(input: unknown): Promise<MercadoPagoCheckoutResult> {
  if (!isMercadoPagoEnabled()) return { ok: false, error: "El pago con Mercado Pago no está disponible." };
  const parsed = orderRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Completá tu nombre y tu WhatsApp para pagar." };
  const typedPhone = toWhatsAppPhone(parsed.data.customerPhone);
  if (!typedPhone) return { ok: false, error: "Revisá tu número de WhatsApp (por ejemplo 11 2345-6789)." };
  const account = await accountFields(parsed.data.customerName, typedPhone);
  const phone = account.phone;

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "La tienda no está configurada para cobrar por internet." };
  if (!(await allowRequest("pedido", 8, 600))) {
    return { ok: false, error: "Hiciste muchos pedidos seguidos. Esperá unos minutos o escribile a Natu Mariel por WhatsApp." };
  }
  if (await tooManyPending(admin, phone)) return { ok: false, error: PENDING_MESSAGE, pendingLimit: true };
  const resolved = await resolveDelivery(admin, parsed.data);
  if (!resolved.ok) return resolved;
  const zoneName = resolved.delivery.zone?.name ?? null;

  const { data, error } = await admin.rpc("create_order", {
    items: parsed.data.items,
    customer_name: parsed.data.customerName,
  });
  const order = data?.[0];
  if (error || !order) {
    console.error("[pedido] No se pudo registrar:", error?.message);
    return { ok: false, error: orderError(error?.message) };
  }
  const delivery = deliveryFields(resolved.delivery, order.total);

  const [{ error: markError }, { data: items }] = await Promise.all([
    admin
      .from("orders")
      .update({
        payment_method: "mercadopago",
        payment_status: "pending",
        customer_phone: phone,
        ...delivery.fields,
        ...account.fields,
      })
      .eq("id", order.id),
    admin.from("order_items").select("product_id, name, size, quantity, unit_price").eq("order_id", order.id),
  ]);
  if (markError || !items || items.length === 0) {
    console.error("[pedido] No se pudo preparar el pago:", markError?.message);
    await admin.from("orders").update({ status: "cancelled", payment_status: "cancelled" }).eq("id", order.id);
    return { ok: false, error: "No pudimos preparar el pago. Probá de nuevo." };
  }

  const lines = items.map((i) => ({
    id: i.product_id ?? i.name,
    title: i.size ? `${i.name} (${i.size})` : i.name,
    quantity: i.quantity,
    unitPrice: toCents(i.unit_price) / 100,
  }));
  if (delivery.costCents > 0) {
    lines.push({ id: "envio", title: `Envío a ${zoneName}`, quantity: 1, unitPrice: delivery.costCents / 100 });
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
  // A Mariel le avisamos recién cuando el pago se aprueba (ver lib/payments.ts): un pedido sin pagar todavía no es una venta.
  await closeAbandonedMercadoPago(admin, phone, order.id);
  return { ok: true, url: preference.url };
}
