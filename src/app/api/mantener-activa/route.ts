import type { NextRequest } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/** Días que un pedido puede esperar sin pago ni aviso antes de darse de baja solo. */
const EXPIRE_PENDING_DAYS = 7;

/**
 * Vercel la llama una vez por día (ver vercel.json). Hace dos cosas:
 * 1) una consulta mínima a la base de datos para que Supabase (plan gratis) no la ponga en pausa;
 * 2) da de baja los pedidos que quedaron pendientes sin pago ni aviso de pago (no tenían stock descontado).
 */
export async function GET(request: NextRequest) {
  // Si algún día se configura CRON_SECRET en Vercel, solo responde a la tarea automática.
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const admin = createAdminClient();
  if (!admin) return Response.json({ ok: false, error: "sin base de datos" }, { status: 503 });
  const { error } = await admin.from("store_settings").select("id").limit(1);

  const limit = new Date(Date.now() - EXPIRE_PENDING_DAYS * 86_400_000).toISOString();
  const { data: expired, error: expireError } = await admin
    .from("orders")
    .update({ status: "cancelled", payment_status: "cancelled" })
    .eq("status", "pending")
    .eq("stock_applied", false)
    .eq("amount_paid", 0)
    .is("payment_reported_at", null)
    .is("mp_payment_id", null)
    .or("payment_status.is.null,payment_status.eq.pending")
    .lt("created_at", limit)
    .select("id");
  if (expireError) console.error("[vencer-pedidos]", expireError.message);

  // Los de Mercado Pago que nadie llegó a pagar no esperan 7 días: a las 24 horas ya se dan de baja.
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const { error: abandonedError } = await admin
    .from("orders")
    .update({ status: "cancelled", payment_status: "cancelled" })
    .eq("status", "pending")
    .eq("payment_method", "mercadopago")
    .eq("stock_applied", false)
    .is("mp_payment_id", null)
    .lt("created_at", dayAgo);
  if (abandonedError) console.error("[vencer-pedidos-mp]", abandonedError.message);

  return Response.json(
    { ok: !error, expired: expired?.length ?? 0 },
    { status: error ? 503 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
