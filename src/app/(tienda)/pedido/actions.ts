"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { toWhatsAppPhone } from "@/lib/debts";
import { canReportPayment, normalizeOrderCode } from "@/lib/order-tracking";
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
    proofPath = `orders/${orderId}/${crypto.randomUUID()}.${PROOF_TYPES[proof.type]}`;
    const { error } = await admin.storage
      .from(PROOF_BUCKET)
      .upload(proofPath, new Uint8Array(await proof.arrayBuffer()), { contentType: proof.type, upsert: false });
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
  const { data: order } = await admin
    .from("orders")
    .select("id")
    .eq("code", code)
    .eq("customer_phone", phone)
    .maybeSingle();
  if (!order) return { error: "No encontramos un pedido con ese código y ese WhatsApp." };
  redirect(`/pedido/${order.id}`);
}
