import type { NextRequest } from "next/server";

import { syncMercadoPagoPayment } from "@/lib/payments";

/**
 * Aviso de Mercado Pago (webhook). Trae solo el número de pago: el estado real lo
 * consultamos nosotros a Mercado Pago, así un aviso falso no puede marcar nada como pagado.
 */
export async function POST(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  let type = params.get("type") ?? params.get("topic");
  let id = params.get("data.id") ?? params.get("id");

  try {
    const body = (await request.json()) as { type?: string; data?: { id?: string | number } };
    type = body.type ?? type;
    if (body.data?.id !== undefined) id = String(body.data.id);
  } catch {
    // Algunos avisos vienen sin cuerpo: alcanza con la URL.
  }

  if (type === "payment" && id) {
    await syncMercadoPagoPayment(id);
  }
  // Siempre 200: si no, Mercado Pago reintenta una y otra vez.
  return new Response(null, { status: 200 });
}
