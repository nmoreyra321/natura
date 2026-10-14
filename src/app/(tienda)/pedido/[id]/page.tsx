import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PaidOrderActions } from "@/components/store/paid-order-actions";
import { buttonClasses } from "@/components/ui/button";
import { getSiteUrl } from "@/lib/config";
import { formatARS } from "@/lib/format";
import { syncMercadoPagoPayment } from "@/lib/payments";
import { toCents } from "@/lib/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildOrderMessage, buildWhatsAppUrl, getWhatsAppNumber } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Tu pedido",
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** A esta página vuelve la clienta desde Mercado Pago (aprobado, pendiente o rechazado). */
export default async function OrderPage({ params, searchParams }: PageProps<"/pedido/[id]">) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const sp = await searchParams;

  // Si Mercado Pago nos devuelve el número de pago, lo verificamos ya (el aviso puede tardar).
  const paymentId = one(sp.payment_id) || one(sp.collection_id);
  if (paymentId && paymentId !== "null") await syncMercadoPagoPayment(paymentId);

  const admin = createAdminClient();
  if (!admin) notFound();
  const { data: order } = await admin
    .from("orders")
    .select("id, code, total, savings, customer_name, payment_method, payment_status, items:order_items(name, size, quantity, unit_price, magazine_price)")
    .eq("id", id)
    .maybeSingle();
  if (!order || order.payment_method !== "mercadopago") notFound();

  const status = order.payment_status ?? "pending";
  const approved = status === "approved";
  const waiting = status === "pending" || status === "in_process";

  const whatsapp = getWhatsAppNumber();
  const lines = order.items.map((i) => ({
    name: i.name,
    size: i.size,
    quantity: i.quantity,
    unitCents: toCents(i.unit_price),
    magazineUnitCents: toCents(i.magazine_price),
  }));
  const whatsappUrl =
    whatsapp && approved
      ? buildWhatsAppUrl(
          whatsapp,
          buildOrderMessage(lines, getSiteUrl(), {
            orderCode: order.code,
            customerName: order.customer_name,
            paid: true,
          }),
        )
      : null;

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      <div className="rounded-3xl border-2 border-forest bg-warm-white p-6 text-center shadow-[4px_4px_0_var(--forest)] sm:p-8">
        {approved ? (
          <CheckCircle2 className="mx-auto size-14 text-botanical-deep" aria-hidden="true" />
        ) : waiting ? (
          <Clock className="mx-auto size-14 text-grape" aria-hidden="true" />
        ) : (
          <XCircle className="mx-auto size-14 text-coral-deep" aria-hidden="true" />
        )}
        <h1 className="mt-3 font-display text-3xl font-bold">
          {approved ? "¡Pago aprobado!" : waiting ? "Tu pago está en proceso" : "El pago no se completó"}
        </h1>
        <p className="mt-2 text-muted">
          Pedido <strong className="text-forest">{order.code}</strong> · {formatARS(toCents(order.total))}
        </p>
        <p className="mt-4">
          {approved
            ? "¡Gracias por tu compra! Avisá a Natu Mariel por WhatsApp para coordinar la entrega."
            : waiting
              ? "Mercado Pago todavía está procesando el pago (por ejemplo, si elegiste pagar en efectivo en un punto de pago). Cuando se acredite, Mariel lo va a ver en su panel."
              : "No se hizo ningún cobro. Podés volver al carrito y probar de nuevo, o elegir pagar en efectivo."}
        </p>

        <ul className="mt-5 divide-y divide-line/70 rounded-2xl border border-line/70 text-left text-sm">
          {order.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-3 px-3 py-2">
              <span>
                <strong className="tabular">{i.quantity} ×</strong> {i.name}
                {i.size ? <span className="text-muted"> ({i.size})</span> : null}
              </span>
              <span className="shrink-0 tabular">{formatARS(toCents(i.unit_price) * i.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col gap-3">
          {approved ? <PaidOrderActions whatsappUrl={whatsappUrl} /> : null}
          {!approved && !waiting ? (
            <Link href="/carrito" className={buttonClasses("primary", "lg")}>
              Volver al carrito
            </Link>
          ) : null}
          <Link href="/productos" className="text-sm font-semibold text-coral-deep hover:underline">
            Seguir mirando productos
          </Link>
        </div>
      </div>
    </div>
  );
}
