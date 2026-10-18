"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { toWhatsAppPhone } from "@/lib/debts";
import { getSiteUrl } from "@/lib/config";
import { createPreference, isMercadoPagoEnabled } from "@/lib/mercadopago";
import { canChangePayment, canCustomerCancel, canReportPayment, isUnpaidMercadoPago, normalizeOrderCode, paymentState } from "@/lib/order-tracking";
import { formatARS } from "@/lib/format";
import { surchargeCents, toCents } from "@/lib/pricing";
import { notifyAdmins } from "@/lib/push";
import { allowRequest } from "@/lib/rate-limit";
import { getMercadoPagoSurcharge, getTransferDetails } from "@/lib/store-settings";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROOF_BUCKET = "payment-proofs";
const PROOF_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};
const MAX_PROOF_BYTES = 3_800_000;

/** Revisa los primeros bytes: que el archivo sea de verdad una foto o un PDF (no solo que lo diga). */
function looksLike(type: string, bytes: Uint8Array): boolean {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (type === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (type === "image/png") return starts(0x89, 0x50, 0x4e, 0x47);
  if (type === "image/webp") return starts(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45;
  if (type === "application/pdf") return starts(0x25, 0x50, 0x44, 0x46);
  return false;
}

export type ReportPaymentResult = { ok: true } | { ok: false; error: string };

/**
 * La clienta avisa que ya transfirió (con el comprobante, si lo sube). El pedido queda
 * "por revisar" hasta que la administradora apruebe o rechace el pago desde el panel.
 * Quien tiene el enlace del pedido (un código largo al azar) es quien lo hizo.
 */
export async function reportTransferPayment(formData: FormData): Promise<ReportPaymentResult> {
  const orderId = String(formData.get("orderId") ?? "");
  if (!UUID_RE.test(orderId)) return { ok: false, error: "No encontramos tu pedido." };
  const file = formData.get("proof");
  const proof = file instanceof File && file.size > 0 ? file : null;
  if (proof) {
    if (!PROOF_TYPES[proof.type]) return { ok: false, error: "El comprobante tiene que ser una foto o un PDF." };
    if (proof.size > MAX_PROOF_BYTES) return { ok: false, error: "El archivo es muy pesado. Probá con una captura de pantalla." };
  }

  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "La tienda no está configurada." };
  if (!(await allowRequest("aviso-pago", 10, 3600))) {
    return { ok: false, error: "Ya avisaste varias veces. Si necesitás ayuda, escribile a Natu Mariel por WhatsApp." };
  }
  const { data: order } = await admin
    .from("orders")
    .select("id, status, payment_method, payment_status, amount_paid, total, payment_reported_at, payment_rejection, payment_proof_path")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "No encontramos tu pedido." };
  if (!canReportPayment(order)) {
    return { ok: false, error: order.payment_reported_at ? "Ya nos avisaste: estamos revisando tu pago." : "Este pedido no espera un pago." };
  }

  let proofPath: string | null = null;
  if (proof) {
    const bytes = new Uint8Array(await proof.arrayBuffer());
    if (!looksLike(proof.type, bytes)) return { ok: false, error: "El comprobante tiene que ser una foto o un PDF." };
    proofPath = `orders/${orderId}/${crypto.randomUUID()}.${PROOF_TYPES[proof.type]}`;
    const { error } = await admin.storage.from(PROOF_BUCKET).upload(proofPath, bytes, { contentType: proof.type, upsert: false });
    if (error) {
      console.error("[comprobante] No se pudo guardar:", error.message);
      return { ok: false, error: "No pudimos guardar el comprobante. Probá de nuevo." };
    }
  }

  const { error } = await admin
    .from("orders")
    .update({
      payment_reported_at: new Date().toISOString(),
      payment_rejection: null,
      ...(proofPath ? { payment_proof_path: proofPath } : {}),
    })
    .eq("id", orderId);
  if (error) {
    console.error("[comprobante] No se pudo anotar el aviso:", error.message);
    if (proofPath) await admin.storage.from(PROOF_BUCKET).remove([proofPath]);
    return { ok: false, error: "No pudimos avisar el pago. Probá de nuevo." };
  }
  // El comprobante anterior (si se reemplazó) ya no sirve.
  if (proofPath && order.payment_proof_path) await admin.storage.from(PROOF_BUCKET).remove([order.payment_proof_path]);
  after(() =>
    notifyAdmins({
      title: "💳 Te avisaron un pago",
      body: "Una clienta avisó que pagó. Revisalo y confirmalo en el panel.",
      url: "/admin/pedidos",
      tag: `pago-${orderId}`,
    }),
  );

  revalidatePath(`/pedido/${orderId}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { ok: true };
}

export type FindOrderState =
  | { error: string }
  /** Encontrado: el pedido buscado y los otros del último mes con ese WhatsApp, para guardarlos en este celular. */
  | { found: { id: string; code: string; at: string }[]; go: string }
  | null;

/**
 * Busca el pedido por código + WhatsApp (los dos tienen que coincidir). Como eso prueba que es
 * la clienta, también devuelve sus otros pedidos del último mes, así aparecen todos en la lista
 * aunque los haya hecho desde otro celular.
 */
export async function findOrder(_prev: FindOrderState, formData: FormData): Promise<FindOrderState> {
  const code = normalizeOrderCode(String(formData.get("code") ?? ""));
  const phone = toWhatsAppPhone(String(formData.get("phone") ?? ""));
  if (!code) return { error: "Revisá el código: es el que empieza con NM- (por ejemplo NM-1A2B3C)." };
  if (!phone) return { error: "Escribí el WhatsApp con el que hiciste el pedido." };

  const admin = createAdminClient();
  if (!admin) return { error: "La tienda no está configurada." };
  if (!(await allowRequest("buscar-pedido", 15, 600))) {
    return { error: "Hiciste muchas búsquedas seguidas. Esperá unos minutos y probá de nuevo." };
  }
  const { data: order } = await admin
    .from("orders")
    .select("id")
    .eq("code", code)
    .eq("customer_phone", phone)
    .maybeSingle();
  if (!order) return { error: "No encontramos un pedido con ese código y ese WhatsApp." };
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data: others } = await admin
    .from("orders")
    .select("id, code, created_at")
    .eq("customer_phone", phone)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(10);
  const found = (others ?? []).map((o) => ({ id: o.id, code: o.code, at: o.created_at }));
  return { found: found.some((o) => o.id === order.id) ? found : [...found, { id: order.id, code, at: new Date().toISOString() }], go: order.id };
}

export type CancelOrderResult = { ok: true } | { ok: false; error: string };

/**
 * La clienta cancela su pedido desde la página (quien tiene el enlace es quien lo hizo).
 * El pedido NO se borra: queda cancelado en el panel, con la marca «Cancelado por la clienta».
 * Los pedidos pendientes no descontaron stock, así que no hay stock que devolver.
 */
export async function cancelMyOrder(orderId: string): Promise<CancelOrderResult> {
  if (!UUID_RE.test(orderId)) return { ok: false, error: "No encontramos tu pedido." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "La tienda no está configurada." };
  if (!(await allowRequest("cancelar-pedido", 10, 3600))) {
    return { ok: false, error: "Probaste muchas veces. Escribile a Natu Mariel por WhatsApp." };
  }
  const { data: order } = await admin
    .from("orders")
    .select("id, status, stock_applied, payment_method, payment_status, mp_payment_id, amount_paid, total, payment_reported_at, payment_rejection")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "No encontramos tu pedido." };
  if (order.stock_applied || !canCustomerCancel(order)) {
    return { ok: false, error: "Este pedido ya no se puede cancelar desde acá. Escribile a Natu Mariel por WhatsApp." };
  }
  // Solo si sigue igual (por si Natu Mariel lo confirmó o llegó un pago en este momento).
  const { data: done, error } = await admin
    .from("orders")
    .update({
      status: "cancelled",
      customer_cancelled_at: new Date().toISOString(),
      ...(order.payment_method === "mercadopago" ? { payment_status: "cancelled" } : {}),
    })
    .eq("id", orderId)
    .eq("status", "pending")
    .eq("stock_applied", false)
    .is("payment_reported_at", null)
    .select("id");
  if (error) {
    console.error("[cancelar] No se pudo cancelar:", error.message);
    return { ok: false, error: "No pudimos cancelar el pedido. Probá de nuevo." };
  }
  if (!done?.length) return { ok: false, error: "Este pedido ya no se puede cancelar desde acá. Escribile a Natu Mariel por WhatsApp." };
  after(() =>
    notifyAdmins({ title: "❌ Pedido cancelado", body: "Una clienta canceló su pedido desde la tienda.", url: "/admin/pedidos?estado=cancelled", tag: `cancelado-${orderId}` }),
  );

  revalidatePath(`/pedido/${orderId}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  return { ok: true };
}

export type MyOrderStatus = { id: string; label: string; tone: "good" | "wait" | "bad"; totalCents: number; items: number };

/** En qué está cada pedido guardado en el celular (para la lista de «Seguir mi pedido»). */
export async function myOrdersStatus(ids: string[]): Promise<MyOrderStatus[]> {
  const valid = ids.filter((id) => UUID_RE.test(id)).slice(0, 10);
  if (valid.length === 0) return [];
  const admin = createAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("orders")
    .select("id, status, total, payment_method, payment_status, amount_paid, payment_reported_at, payment_rejection, items:order_items(quantity)")
    .in("id", valid);
  return (data ?? []).map((o) => {
    const state = paymentState(o);
    const [label, tone]: [string, MyOrderStatus["tone"]] =
      o.status === "cancelled"
        ? ["Cancelado", "bad"]
        : o.status === "delivered"
          ? ["Entregado", "good"]
          : state === "paid"
            ? ["Pago confirmado", "good"]
            : state === "review"
              ? ["Verificando tu pago", "wait"]
              : o.status === "confirmed"
                ? ["Confirmado", "good"]
                : ["Pendiente", "wait"];
    return {
      id: o.id,
      label,
      tone,
      totalCents: toCents(o.total),
      items: (o.items ?? []).reduce((s, i) => s + i.quantity, 0),
    };
  });
}

export type ReviewResult = { ok: true } | { ok: false; error: string };

/**
 * Una clienta deja su reseña: nombre y apellido, estrellas y reseña. Desde la página de su pedido
 * queda unida a ese pedido (una por pedido, no en los cancelados); desde el inicio, sin pedido.
 * No se exige compra: si alguien no compró, Natu Mariel lo aclara en la respuesta o la saca.
 */
export async function submitReview(input: { orderId?: string | null; name: string; rating: number; comment: string }): Promise<ReviewResult> {
  const name = input.name.trim().replace(/\s+/g, " ");
  const comment = input.comment.trim();
  const rating = Math.round(Number(input.rating));
  if (input.orderId && !UUID_RE.test(input.orderId)) return { ok: false, error: "No encontramos tu pedido." };
  if (name.length > 60 || name.split(" ").filter((w) => w.length >= 2).length < 2) return { ok: false, error: "Escribí tu nombre y apellido." };
  if (!(rating >= 1 && rating <= 5)) return { ok: false, error: "Elegí cuántas estrellas le das." };
  if (comment.length < 3) return { ok: false, error: "Escribí tu reseña." };
  if (comment.length > 500) return { ok: false, error: "La reseña es muy larga (hasta 500 caracteres)." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "La tienda no está configurada." };
  if (!(await allowRequest("resena", 5, 3600))) {
    return { ok: false, error: "Probaste muchas veces. Intentá más tarde." };
  }
  let orderId: string | null = null;
  if (input.orderId) {
    const { data: order } = await admin.from("orders").select("id, status").eq("id", input.orderId).maybeSingle();
    if (!order || order.status === "cancelled") return { ok: false, error: "Este pedido no puede dejar reseña." };
    orderId = order.id;
  }

  const { error } = await admin.from("reviews").insert({ order_id: orderId, name, rating, comment });
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Ya dejaste tu reseña para este pedido. ¡Gracias!" };
    console.error("[reseña] No se pudo guardar:", error.message);
    return { ok: false, error: "No pudimos guardar tu reseña. Probá de nuevo." };
  }
  after(() =>
    notifyAdmins({
      title: `${"⭐".repeat(rating)} Nueva reseña`,
      body: `${name}: ${comment.slice(0, 100)}`,
      url: "/admin/resenas",
      tag: `resena-${Date.now()}`,
    }),
  );
  if (orderId) revalidatePath(`/pedido/${orderId}`);
  revalidatePath("/");
  revalidatePath("/admin/resenas");
  return { ok: true };
}

export type RetryPaymentResult = { ok: true; url: string } | { ok: false; error: string };

/** La clienta volvió de Mercado Pago sin pagar: arma un link de pago nuevo para el mismo pedido. */
export async function retryMercadoPago(orderId: string): Promise<RetryPaymentResult> {
  if (!UUID_RE.test(orderId)) return { ok: false, error: "No encontramos tu pedido." };
  if (!isMercadoPagoEnabled()) return { ok: false, error: "El pago con Mercado Pago no está disponible." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "La tienda no está configurada." };
  if (!(await allowRequest("reintentar-pago", 10, 3600))) {
    return { ok: false, error: "Probaste muchas veces. Escribile a Natu Mariel por WhatsApp." };
  }
  const { data: order } = await admin
    .from("orders")
    .select("id, number, status, stock_applied, payment_method, payment_status, mp_payment_id, total, shipping_cost, shipping_zone, items:order_items(product_id, name, size, quantity, unit_price)")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.stock_applied || !isUnpaidMercadoPago({ ...order, amount_paid: 0, payment_reported_at: null, payment_rejection: null })) {
    return { ok: false, error: "Este pedido ya no se puede pagar desde acá. Escribile a Natu Mariel por WhatsApp." };
  }
  const lines = order.items.map((i) => ({
    id: i.product_id ?? i.name,
    title: i.size ? `${i.name} (${i.size})` : i.name,
    quantity: i.quantity,
    unitPrice: toCents(i.unit_price) / 100,
  }));
  const shippingCents = toCents(order.shipping_cost);
  if (shippingCents > 0) lines.push({ id: "envio", title: `Envío a ${order.shipping_zone ?? "tu casa"}`, quantity: 1, unitPrice: shippingCents / 100 });
  // El total del pedido ya incluye el envío: el recargo se calcula sobre ese total.
  const surcharge = surchargeCents(toCents(order.total), await getMercadoPagoSurcharge());
  if (surcharge > 0) lines.push({ id: "recargo-mp", title: "Recargo por pago con Mercado Pago", quantity: 1, unitPrice: surcharge / 100 });
  const preference = await createPreference({ orderId: order.id, orderNumber: order.number, siteUrl: getSiteUrl(), items: lines });
  if (!preference) return { ok: false, error: "Mercado Pago no respondió. Probá de nuevo en un rato o elegí pagar en efectivo." };
  return { ok: true, url: preference.url };
}

/** La clienta no quiso pagar con Mercado Pago: el mismo pedido pasa a efectivo (se paga al recibir). */
export async function switchOrderToCash(orderId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(orderId)) return { ok: false, error: "No encontramos tu pedido." };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "La tienda no está configurada." };
  if (!(await allowRequest("pedido-a-efectivo", 10, 3600))) {
    return { ok: false, error: "Probaste muchas veces. Escribile a Natu Mariel por WhatsApp." };
  }
  const { data: done, error } = await admin
    .from("orders")
    .update({ payment_method: "efectivo", payment_status: null })
    .eq("id", orderId)
    .eq("status", "pending")
    .eq("payment_method", "mercadopago")
    .eq("stock_applied", false)
    .is("mp_payment_id", null)
    .select("id, customer_name, total");
  if (error || !done?.length) return { ok: false, error: "Este pedido ya no se puede cambiar desde acá. Escribile a Natu Mariel por WhatsApp." };
  const order = done[0];
  after(() =>
    notifyAdmins({
      title: "🛍 Pedido nuevo",
      body: `${order.customer_name ?? "Una clienta"} · ${formatARS(toCents(order.total))} · paga en efectivo`,
      url: "/admin/pedidos",
      tag: `pedido-${orderId}`,
    }),
  );
  revalidatePath(`/pedido/${orderId}`);
  revalidatePath("/admin/pedidos");
  return { ok: true };
}

export type PaymentChoice = "efectivo" | "transferencia" | "mercadopago";

const PAYMENT_LABEL: Record<PaymentChoice, string> = {
  efectivo: "efectivo",
  transferencia: "transferencia",
  mercadopago: "Mercado Pago",
};

/** La clienta se equivocó o se arrepintió: el mismo pedido pasa a otra forma de pago, mientras no haya pagado nada. */
export async function changePaymentMethod(orderId: string, method: PaymentChoice): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!UUID_RE.test(orderId)) return { ok: false, error: "No encontramos tu pedido." };
  if (!["efectivo", "transferencia", "mercadopago"].includes(method)) return { ok: false, error: "Elegí una forma de pago." };
  if (method === "mercadopago" && !isMercadoPagoEnabled()) return { ok: false, error: "El pago con Mercado Pago no está disponible." };
  if (method === "transferencia") {
    const transfer = await getTransferDetails();
    if (!transfer?.alias && !transfer?.cbu) return { ok: false, error: "La transferencia no está disponible." };
  }
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "La tienda no está configurada." };
  if (!(await allowRequest("cambiar-pago", 10, 3600))) {
    return { ok: false, error: "Probaste muchas veces. Escribile a Natu Mariel por WhatsApp." };
  }
  const { data: order } = await admin
    .from("orders")
    .select("id, status, payment_method, payment_status, mp_payment_id, amount_paid, total, payment_reported_at, payment_rejection, customer_name")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || !canChangePayment(order)) {
    return { ok: false, error: "Este pedido ya no se puede cambiar desde acá. Escribile a Natu Mariel por WhatsApp." };
  }
  if (order.payment_method === method) return { ok: true };
  const { data: done, error } = await admin
    .from("orders")
    .update({ payment_method: method, payment_status: null, payment_rejection: null })
    .eq("id", orderId)
    .eq("status", "pending")
    .eq("payment_method", order.payment_method)
    .is("mp_payment_id", null)
    .is("payment_reported_at", null)
    .select("id");
  if (error || !done?.length) return { ok: false, error: "No pudimos cambiar el pedido. Probá de nuevo o escribile a Natu Mariel por WhatsApp." };
  after(() =>
    notifyAdmins({
      title: "🔄 Cambió la forma de pago",
      body: `${order.customer_name ?? "Una clienta"} · ${formatARS(toCents(order.total))} · ahora paga con ${PAYMENT_LABEL[method]}`,
      url: "/admin/pedidos",
      tag: `pedido-${orderId}`,
    }),
  );
  revalidatePath(`/pedido/${orderId}`);
  revalidatePath("/admin/pedidos");
  return { ok: true };
}
