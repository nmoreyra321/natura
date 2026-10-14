import "server-only";

/**
 * Mercado Pago Checkout Pro: armamos una "preferencia" con los productos y mandamos a la clienta
 * a pagar a la página de Mercado Pago. Mercado Pago avisa el resultado a /api/mercadopago.
 *
 * Se activa con la variable MP_ACCESS_TOKEN (Access Token de producción de la cuenta de Mercado Pago).
 * Sin esa variable, la opción no aparece en el carrito.
 */

const API = "https://api.mercadopago.com";

function accessToken(): string | null {
  return process.env.MP_ACCESS_TOKEN?.trim() || null;
}

export function isMercadoPagoEnabled(): boolean {
  return accessToken() !== null;
}

export type PreferenceItem = { id: string; title: string; quantity: number; unitPrice: number };

export async function createPreference(input: {
  orderId: string;
  orderNumber: number;
  items: PreferenceItem[];
  siteUrl: string;
}): Promise<{ url: string } | null> {
  const token = accessToken();
  if (!token) return null;
  const back = `${input.siteUrl}/pedido/${input.orderId}`;
  const res = await fetch(`${API}/checkout/preferences`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      items: input.items.map((i) => ({
        id: i.id,
        title: i.title.slice(0, 250),
        quantity: i.quantity,
        unit_price: i.unitPrice,
        currency_id: "ARS",
      })),
      external_reference: input.orderId,
      statement_descriptor: "NATU MARIEL",
      metadata: { order_number: input.orderNumber },
      back_urls: { success: back, pending: back, failure: back },
      auto_return: "approved",
      // Mercado Pago solo acepta avisos a direcciones públicas con https.
      ...(input.siteUrl.startsWith("https://") ? { notification_url: `${input.siteUrl}/api/mercadopago` } : {}),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    console.error("[mercadopago] No se pudo crear la preferencia:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const data = (await res.json()) as { init_point?: string };
  return data.init_point ? { url: data.init_point } : null;
}

export type MercadoPagoPayment = {
  id: string;
  status: string;
  orderId: string | null;
  amount: number;
};

/** Consulta un pago directamente a Mercado Pago (así nadie puede inventar un pago aprobado). */
export async function getPayment(paymentId: string): Promise<MercadoPagoPayment | null> {
  const token = accessToken();
  if (!token || !/^\d{1,30}$/.test(paymentId)) return null;
  const res = await fetch(`${API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    id: number;
    status: string;
    external_reference?: string | null;
    transaction_amount?: number;
  };
  return {
    id: String(data.id),
    status: data.status,
    orderId: data.external_reference ?? null,
    amount: Number(data.transaction_amount ?? 0),
  };
}

export const PAYMENT_STATUSES = [
  "pending",
  "in_process",
  "approved",
  "rejected",
  "cancelled",
  "refunded",
  "charged_back",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export function isPaymentStatus(value: string): value is PaymentStatus {
  return (PAYMENT_STATUSES as readonly string[]).includes(value);
}
