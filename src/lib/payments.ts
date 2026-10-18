import "server-only";

import { formatARS } from "@/lib/format";
import { getPayment, isPaymentStatus, type PaymentStatus } from "@/lib/mercadopago";
import { recommendedPercent } from "@/lib/mp-fees";
import { toCents } from "@/lib/pricing";
import { notifyAdmins } from "@/lib/push";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMercadoPagoSurcharge } from "@/lib/store-settings";

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
    .select("id, code, total, status, customer_name, payment_method, payment_status")
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

  const approved = payment.status === "approved";
  const patch = approved
    ? {
        payment_status: payment.status,
        mp_payment_id: payment.id,
        amount_paid: Number(order.total),
        paid_at: new Date().toISOString(),
        mp_net_received: payment.netReceived,
      }
    : { payment_status: payment.status, mp_payment_id: payment.id };
  // Solo cuenta como «recién aprobado» la primera vez (el aviso de Mercado Pago y la vuelta de la clienta pueden llegar los dos).
  const { data: changed, error } = await admin
    .from("orders")
    .update(patch)
    .eq("id", order.id)
    .or("payment_status.is.null,payment_status.neq." + payment.status)
    .select("id");
  if (error) {
    console.error("[pagos] No se pudo anotar el pago:", error.message);
    return null;
  }
  if (changed && changed.length > 0) await afterPaymentChange(admin, order, payment.status, { amount: payment.amount, net: payment.netReceived });
  return { orderId: order.id, status: payment.status };
}

type PaidOrder = { id: string; code: string; total: number | string; status: string; customer_name: string | null };

/** Pago aprobado: se confirma el pedido y se descuenta el stock solo. Devolución o contracargo: se avisa para revisar. */
async function afterPaymentChange(
  admin: NonNullable<ReturnType<typeof createAdminClient>>,
  order: PaidOrder,
  status: PaymentStatus,
  money: { amount: number; net: number | null },
) {
  const who = order.customer_name?.trim() || "Una clienta";
  const amount = formatARS(toCents(order.total));
  const url = "/admin/pedidos";
  if (status === "approved") {
    await warnIfFeeTooHigh(order, money);
    if (order.status === "pending") {
      const { error } = await admin.rpc("apply_order_status", { order_id: order.id, new_status: "confirmed" });
      if (error) {
        console.error("[pagos] No se pudo confirmar el pedido pagado:", error.message);
        await notifyAdmins({ title: "💳 Pago aprobado", body: `${who} pagó ${amount} (pedido ${order.code}). Entrá a confirmarlo.`, url, tag: `pago-${order.id}` });
        return;
      }
      await notifyAdmins({ title: "💳 Pago aprobado", body: `${who} pagó ${amount} por Mercado Pago. Pedido ${order.code} confirmado, el stock ya se descontó.`, url, tag: `pago-${order.id}` });
    } else if (order.status === "cancelled") {
      await notifyAdmins({ title: "⚠️ Pago en un pedido cancelado", body: `${who} pagó ${amount} pero el pedido ${order.code} estaba cancelado. Revisalo.`, url, tag: `pago-${order.id}` });
    }
    return;
  }
  if (status === "refunded" || status === "charged_back") {
    await notifyAdmins({
      title: status === "refunded" ? "↩️ Pago devuelto" : "⚠️ Contracargo",
      body: `El pago de ${who} (${amount}, pedido ${order.code}) fue ${status === "refunded" ? "devuelto" : "reclamado"}. Revisá el pedido.`,
      url,
      tag: `pago-${order.id}`,
    });
  }
}

/**
 * Compara lo que le llegó a la vendedora con lo que debía llegar (el total del pedido, sin recargo).
 * Si Mercado Pago cobró más comisión de la que cubre el recargo, le avisa y sugiere el recargo justo.
 */
async function warnIfFeeTooHigh(order: PaidOrder, money: { amount: number; net: number | null }) {
  const expected = Number(order.total);
  if (money.net === null || !(money.amount > 0) || money.net + 0.5 >= expected) return;
  const feeShare = (money.amount - money.net) / money.amount;
  if (!(feeShare > 0 && feeShare < 0.5)) return;
  const suggested = recommendedPercent(Math.ceil(((feeShare / (1 - feeShare)) * 100) * 10) / 10);
  const current = await getMercadoPagoSurcharge();
  await notifyAdmins({
    title: "⚠️ Mercado Pago cobró más comisión",
    body: `En el pedido ${order.code} te llegaron ${formatARS(toCents(money.net))} en vez de ${formatARS(toCents(expected))}. El recargo hoy es ${current}%: conviene subirlo a ${String(suggested).replace(".", ",")}% (Configuración).`,
    url: "/admin/configuracion",
    tag: `comision-${order.id}`,
  });
}
