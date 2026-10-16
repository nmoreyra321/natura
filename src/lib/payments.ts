import "server-only";

import { getPayment, isPaymentStatus, type PaymentStatus } from "@/lib/mercadopago";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Consulta el pago en Mercado Pago y lo anota en el pedido.
 * Solo se marca "aprobado" si el monto pagado cubre el total del pedido.
 */
export async function syncMercadoPagoPayment(
  paymentId: string,
): Promise<{ orderId: string; status: PaymentStatus } | null> {
  const payment = await getPayment(paymentId);
  if (!payment || !payment.orderId || !UUID_RE.test(payment.orderId) || !isPaymentStatus(payment.status)) {
    return null;
  }
  const admin = createAdminClient();
  if (!admin) {
    console.error("[pagos] Falta SUPABASE_SECRET_KEY para anotar el pago.");
    return null;
  }
  const { data: order } = await admin
    .from("orders")
    .select("id, total, payment_method, payment_status")
    .eq("id", payment.orderId)
    .maybeSingle();
  if (!order || order.payment_method !== "mercadopago") return null;

  // Si ya estaba aprobado, solo una devolución o un contracargo lo cambian (no un aviso viejo).
  if (order.payment_status === "approved" && !["approved", "refunded", "charged_back"].includes(payment.status)) {
    return { orderId: order.id, status: "approved" };
  }

  if (payment.status === "approved" && payment.amount + 0.01 < Number(order.total)) {
    console.error(`[pagos] Pago ${payment.id} por ${payment.amount} no cubre el pedido ${order.id} (${order.total}).`);
    return null;
  }

  const { error } = await admin
    .from("orders")
    .update({ payment_status: payment.status, mp_payment_id: payment.id })
    .eq("id", order.id);
  if (error) {
    console.error("[pagos] No se pudo anotar el pago:", error.message);
    return null;
  }
  return { orderId: order.id, status: payment.status };
}
