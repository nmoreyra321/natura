"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";

import { toWhatsAppPhone } from "@/lib/debts";
import { canCustomerCancel, canReportPayment, normalizeOrderCode, paymentState } from "@/lib/order-tracking";
import { toCents } from "@/lib/pricing";
import { loyaltyKey, loyaltyStatus, PURCHASE_STATUSES } from "@/lib/loyalty";
import { notifyAdmins } from "@/lib/push";
import { getLoyaltyMinTotal } from "@/lib/store-settings";
import { allowRequest } from "@/lib/rate-limit";
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
    return { ok: false, error: order.payment_reported_at ? "Ya nos avisaste: estamos revisando tu pago." : "Este pedido no espera una transferencia." };
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

export type FindOrderState = { error: string } | null;

/** Busca el pedido por código + WhatsApp (los dos tienen que coincidir) y lleva a su página. */
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
  redirect(`/pedido/${order.id}?guardar=1`);
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
    .select("id, status, stock_applied, payment_method, payment_status, amount_paid, total, payment_reported_at, payment_rejection")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: "No encontramos tu pedido." };
  if (order.stock_applied || !canCustomerCancel(order)) {
    return { ok: false, error: "Este pedido ya no se puede cancelar desde acá. Escribile a Natu Mariel por WhatsApp." };
  }
  // Solo si sigue igual (por si Natu Mariel lo confirmó o llegó un pago en este momento).
  const { data: done, error } = await admin
    .from("orders")
    .update({ status: "cancelled", customer_cancelled_at: new Date().toISOString() })
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

export type ClubProgress = { progress: number; left: number; pending: number; minCents: number };

/**
 * Avance en el Club de la clienta que usa este celular, a partir de sus pedidos guardados
 * (quien tiene el enlace del pedido es quien lo hizo). null si no hay pedidos con WhatsApp.
 */
export async function clubProgress(orderIds: string[]): Promise<ClubProgress | null> {
  const ids = orderIds.filter((id) => UUID_RE.test(id)).slice(0, 10);
  if (ids.length === 0) return null;
  const admin = createAdminClient();
  if (!admin) return null;
  const { data: own } = await admin.from("orders").select("customer_phone, created_at").in("id", ids).order("created_at", { ascending: false });
  const key = (own ?? []).map((o) => loyaltyKey(o.customer_phone)).find(Boolean);
  if (!key) return null;
  const min = await getLoyaltyMinTotal();
  const [{ count: purchases }, { count: given }] = await Promise.all([
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("customer_phone", key)
      .in("status", [...PURCHASE_STATUSES])
      .eq("payment_status", "approved")
      .gte("total", min),
    admin.from("loyalty_gifts").select("id", { count: "exact", head: true }).eq("phone", key),
  ]);
  const s = loyaltyStatus(purchases ?? 0, given ?? 0);
  return { progress: s.progress, left: s.left, pending: s.pending, minCents: Math.round(min * 100) };
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
  if (comment.length > 500) return { ok: false, error: "La reseña es muy larga (hasta 500 letras)." };
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
