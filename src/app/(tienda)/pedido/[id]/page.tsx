import { AlertCircle, CheckCircle2, Clock, Gift, MessageCircle, PackageCheck, Wallet, XCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BuyAgain } from "@/components/store/buy-again";
import { CancelOrder } from "@/components/store/cancel-order";
import { OrderMissing } from "@/components/store/order-missing";
import { AutoRefresh, MpPayFlow, OrderPageEffects, ReportPayment } from "@/components/store/order-tracking";
import { PaidOrderActions } from "@/components/store/paid-order-actions";
import { ReviewForm } from "@/components/store/review-form";
import { TransferAccount } from "@/components/store/transfer-account";
import { buttonClasses } from "@/components/ui/button";
import { getSiteUrl } from "@/lib/config";
import { formatARS } from "@/lib/format";
import { GIFT_EVERY, loyaltyKey, loyaltyStatus, PURCHASE_STATUSES, type LoyaltyStatus } from "@/lib/loyalty";
import { canCustomerCancel, canReportPayment, owedOf, paymentState, trackingSteps } from "@/lib/order-tracking";
import { syncMercadoPagoPayment } from "@/lib/payments";
import { toCents } from "@/lib/pricing";
import { getLoyaltyMinTotal, getTransferDetails } from "@/lib/store-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildOrderMessage, buildWhatsAppUrl, getWhatsAppNumber } from "@/lib/whatsapp";

export const metadata: Metadata = {
  title: "Tu pedido",
  robots: { index: false, follow: false },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

type Tone = "good" | "wait" | "bad" | "todo";
const TONES: Record<Tone, { icon: string; ring: string }> = {
  good: { icon: "text-botanical-deep", ring: "bg-sage" },
  wait: { icon: "text-grape", ring: "bg-lilac" },
  bad: { icon: "text-coral-deep", ring: "bg-coral-soft" },
  todo: { icon: "text-forest", ring: "bg-sun" },
};

/**
 * Página del pedido de la clienta: en qué está, y si pagó por transferencia, dónde avisa el pago
 * y sube el comprobante. A esta página también vuelve desde Mercado Pago.
 */
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
    .select(
      "id, code, created_at, status, total, savings, customer_name, customer_phone, customer_cancelled_at, payment_method, payment_status, amount_paid, payment_reported_at, payment_rejection, payment_proof_path, items:order_items(product_id, name, size, quantity, unit_price, magazine_price)",
    )
    .eq("id", id)
    .maybeSingle();
  // Ya no existe (por ejemplo, se borró desde el panel): en vez de un error, ofrecer ayuda.
  if (!order) return <OrderMissing id={id} whatsapp={getWhatsAppNumber()} />;

  const isNew = one(sp.nuevo) === "1";
  const state = paymentState(order);
  const steps = trackingSteps(order);
  const cancelled = order.status === "cancelled";
  const isMp = order.payment_method === "mercadopago";
  const isTransfer = order.payment_method === "transferencia";
  const owed = owedOf(order);
  const transfer = isTransfer ? await getTransferDetails() : null;

  // Club de clientas: cuántas compras lleva con este teléfono (si el pedido no está cancelado).
  const clubKey = cancelled ? null : loyaltyKey(order.customer_phone);
  let club: LoyaltyStatus | null = null;
  const clubMin = await getLoyaltyMinTotal();
  const counts = toCents(order.total) >= Math.round(clubMin * 100);
  if (clubKey) {
    const [{ count: purchases }, { count: given }] = await Promise.all([
      admin.from("orders").select("id", { count: "exact", head: true }).eq("customer_phone", clubKey).in("status", [...PURCHASE_STATUSES]).eq("payment_status", "approved").gte("total", clubMin),
      admin.from("loyalty_gifts").select("id", { count: "exact", head: true }).eq("phone", clubKey),
    ]);
    club = loyaltyStatus(purchases ?? 0, given ?? 0);
  }
  // Reseña opcional: una por pedido, y no en los cancelados.
  const { count: reviewed } = cancelled
    ? { count: 1 }
    : await admin.from("reviews").select("id", { count: "exact", head: true }).eq("order_id", order.id);
  const siteUrl = getSiteUrl();
  const trackUrl = `${siteUrl}/pedido/${order.id}`;

  const whatsapp = getWhatsAppNumber();
  const lines = order.items.map((i) => ({
    name: i.name,
    size: i.size,
    quantity: i.quantity,
    unitCents: toCents(i.unit_price),
    magazineUnitCents: toCents(i.magazine_price),
  }));
  const helpUrl = whatsapp
    ? buildWhatsAppUrl(
        whatsapp,
        `Hola Natu Mariel 👋 Tengo una consulta sobre mi pedido ${order.code}${cancelled ? " (figura como cancelado)" : ""}. ${trackUrl}`,
      )
    : null;
  const message = (extra: Parameters<typeof buildOrderMessage>[2]) =>
    whatsapp
      ? buildWhatsAppUrl(whatsapp, buildOrderMessage(lines, siteUrl, { orderCode: order.code, customerName: order.customer_name, trackUrl, ...extra }))
      : null;

  // Qué se le muestra arriba de todo.
  let tone: Tone;
  let Icon = CheckCircle2;
  let title: string;
  let text: React.ReactNode;
  if (cancelled) {
    [tone, Icon, title] = ["bad", XCircle, "Pedido cancelado"];
    text = order.customer_cancelled_at
      ? "Cancelaste este pedido. Si fue sin querer, tocá «Pedir ayuda por WhatsApp» y Natu Mariel te ayuda."
      : "Este pedido se canceló. Si ya lo pagaste o creés que es un error, tocá «Pedir ayuda por WhatsApp» y Natu Mariel lo resuelve con vos.";
  } else if (isMp) {
    if (state === "paid") {
      [tone, Icon, title] = ["good", CheckCircle2, "¡Pago aprobado!"];
      text = "¡Gracias por tu compra! Avisá a Natu Mariel por WhatsApp para coordinar la entrega.";
    } else if (state === "failed") {
      [tone, Icon, title] = ["bad", XCircle, "El pago no se completó"];
      text = "No se hizo ningún cobro. Podés volver al carrito y probar de nuevo, o elegir otra forma de pago.";
    } else {
      [tone, Icon, title] = ["wait", Clock, "Tu pago está en proceso"];
      text =
        "Mercado Pago todavía está procesando el pago (por ejemplo, si elegiste pagar en efectivo en un punto de pago). Cuando se acredite, lo vas a ver acá.";
    }
  } else if (order.status === "delivered") {
    [tone, Icon, title] = ["good", PackageCheck, "¡Pedido entregado!"];
    text = "Gracias por comprar en Natu Mariel. ¡Que lo disfrutes! 💖";
  } else if (isTransfer && state === "paid") {
    [tone, Icon, title] = ["good", CheckCircle2, "¡Pago confirmado!"];
    text =
      "Natu Mariel recibió tu pago y tu pedido ya está reservado. En breve se va a comunicar con vos por WhatsApp para coordinar la entrega.";
  } else if (state === "review") {
    [tone, Icon, title] = ["wait", Clock, "Estamos verificando tu pago"];
    text = (
      <>
        ¡Gracias! Natu Mariel está verificando que el pago se haya acreditado. Te avisamos apenas esté confirmado.
        {order.payment_reported_at ? (
          <span className="mt-1 block text-sm text-muted">Avisaste el {dateFormatter.format(new Date(order.payment_reported_at))}.</span>
        ) : null}
      </>
    );
  } else if (state === "rejected") {
    [tone, Icon, title] = ["bad", AlertCircle, "No pudimos confirmar tu pago"];
    text = (
      <>
        <strong>{order.payment_rejection}</strong>
        <span className="mt-1 block">Revisá el pago y volvé a avisar acá abajo, o escribile a Natu Mariel.</span>
      </>
    );
  } else if (isTransfer && state === "partial") {
    [tone, Icon, title] = ["todo", Wallet, "Recibimos una parte del pago"];
    text = (
      <>
        Falta pagar <strong>{formatARS(owed)}</strong>. Cuando lo hagas, avisá acá abajo.
      </>
    );
  } else if (isTransfer) {
    [tone, Icon, title] = ["todo", Wallet, "¡Recibimos tu pedido!"];
    text = (
      <>
        Natu Mariel recibió tu pedido <strong>{order.code}</strong>. Para confirmarlo, realizá el pago de{" "}
        <strong>{formatARS(owed)}</strong> {transfer?.mpLink ? "con Mercado Pago" : "por transferencia"}.
      </>
    );
  } else if (order.status === "confirmed") {
    [tone, Icon, title] = ["good", CheckCircle2, "¡Pedido confirmado!"];
    text = "Natu Mariel ya separó tus productos y coordina la entrega con vos por WhatsApp.";
  } else {
    [tone, Icon, title] = ["good", CheckCircle2, "¡Recibimos tu pedido!"];
    text = "Natu Mariel te confirma por WhatsApp la disponibilidad y la entrega. Pagás en efectivo al recibirlo.";
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-10 sm:py-14">
      <OrderPageEffects
        id={order.id}
        code={order.code}
        createdAt={order.created_at}
        isNew={isNew}
        remember={isNew || one(sp.guardar) === "1"}
      />
      {state === "review" && !cancelled ? <AutoRefresh /> : null}

      <div className="rounded-3xl border-2 border-forest bg-warm-white p-6 shadow-[4px_4px_0_var(--forest)] sm:p-8">
        <div className="text-center">
          <span className={`mx-auto flex size-16 items-center justify-center rounded-full ${TONES[tone].ring}`}>
            <Icon className={`size-9 ${TONES[tone].icon}`} aria-hidden="true" />
          </span>
          <h1 className="mt-3 font-display text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-muted">
            Pedido <strong className="text-forest">{order.code}</strong> · {formatARS(toCents(order.total))}
          </p>
          <div className="mt-4">{text}</div>
        </div>

        {!cancelled ? (
          <ol className="mt-6 flex items-start" aria-label="Cómo va tu pedido">
            {steps.map((s, n) => (
              <li key={s.label} className="relative flex flex-1 flex-col items-center gap-1.5 text-center">
                {n > 0 ? (
                  <span
                    aria-hidden="true"
                    className={`absolute top-3.5 right-1/2 h-1 w-full -translate-y-1/2 ${s.done && steps[n - 1].done ? "bg-botanical-deep" : "bg-line"}`}
                  />
                ) : null}
                <span
                  className={`relative z-10 flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                    s.done ? "bg-botanical-deep text-white" : "border-2 border-line bg-white text-muted"
                  }`}
                >
                  {s.done ? <CheckCircle2 className="size-4" aria-hidden="true" /> : n + 1}
                </span>
                <span className={`text-xs leading-tight font-bold ${s.done ? "text-forest" : "text-muted"}`}>
                  {s.label}
                  <span className="sr-only">{s.done ? " (listo)" : " (falta)"}</span>
                </span>
              </li>
            ))}
          </ol>
        ) : null}

        {canReportPayment(order) ? (
          <div className="mt-6 rounded-2xl border-2 border-dashed border-botanical/60 bg-sage/40 p-4 text-sm">
            {transfer?.mpLink ? (
              <MpPayFlow
                orderId={order.id}
                link={transfer.mpLink}
                totalCents={owed}
                again={state === "rejected"}
                whatsappUrl={message({ paymentMethod: "transferencia", transferReported: true })}
              />
            ) : (
              <>
                {transfer ? (
                  <>
                    <p className="font-bold">1. Transferí {formatARS(owed)} a esta cuenta</p>
                    <TransferAccount transfer={transfer} totalCents={owed} />
                  </>
                ) : null}
                <p className="mt-5 mb-2 font-bold">{transfer ? "2. " : ""}Avisá que ya pagaste</p>
                <ReportPayment
                  orderId={order.id}
                  whatsappUrl={message({ paymentMethod: "transferencia", transferReported: true })}
                />
              </>
            )}
          </div>
        ) : null}

        {state === "review" && !cancelled && whatsapp ? (
          <a
            href={message({ paymentMethod: "transferencia", transferReported: true }) ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("outline", "md", "mt-5 w-full")}
          >
            <MessageCircle className="size-4" aria-hidden="true" /> Avisarle a Natu Mariel por WhatsApp
          </a>
        ) : null}

        <ul className="mt-6 divide-y divide-line/70 rounded-2xl border border-line/70 bg-white/60 text-left text-sm">
          {order.items.map((i, n) => (
            <li key={n} className="flex justify-between gap-3 px-3 py-2">
              <span>
                <strong className="tabular">{i.quantity} ×</strong> {i.name}
                {i.size ? <span className="text-muted"> ({i.size})</span> : null}
              </span>
              <span className="shrink-0 tabular">{formatARS(toCents(i.unit_price) * i.quantity)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 px-3 py-2 font-extrabold">
            <span>Total</span>
            <span className="tabular">{formatARS(toCents(order.total))}</span>
          </li>
        </ul>

        {club ? (
          <section aria-labelledby="club" className="mt-6 rounded-3xl bg-gradient-to-br from-blush to-sun/40 p-4">
            <h2 id="club" className="flex items-center gap-2 font-display text-lg font-bold">
              <Gift className="size-5 text-coral-deep" aria-hidden="true" /> Club Natu Mariel
            </h2>
            {club.pending > 0 ? (
              <p className="mt-1 font-semibold">¡Te ganaste un regalo! 🎉 Natu Mariel te lo entrega con tu pedido.</p>
            ) : (
              <>
                <p className="mt-1 text-sm">
                  Cada {GIFT_EVERY} compras{clubMin > 0 ? ` de ${formatARS(Math.round(clubMin * 100))} o más` : ""} te ganás un regalo. Llevás <b>{club.progress}</b> de {GIFT_EVERY}
                  {club.left === 1 ? ": ¡te falta solo 1!" : `: te faltan ${club.left}.`}
                </p>
                <span className="mt-2 flex gap-1.5" aria-hidden="true">
                  {Array.from({ length: GIFT_EVERY }, (_, i) => (
                    <span key={i} className={`size-3.5 rounded-full ${i < club.progress ? "bg-coral-deep" : "bg-white"}`} />
                  ))}
                </span>
              </>
            )}
            {!counts ? (
              <p className="mt-2 text-xs text-muted">
                Este pedido no suma porque es de menos de {formatARS(Math.round(clubMin * 100))}. Suman las compras desde ese monto.
              </p>
            ) : order.payment_status !== "approved" || order.status === "pending" ? (
              <p className="mt-2 text-xs text-muted">Este pedido se suma cuando esté pagado completo y confirmado.</p>
            ) : null}
          </section>
        ) : null}

        {!reviewed ? <ReviewForm orderId={order.id} defaultName={order.customer_name?.trim().split(" ")[0] ?? ""} /> : null}

        <div className="mt-6 flex flex-col gap-3 text-center">
          {cancelled && helpUrl ? (
            <a href={helpUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("primary", "lg")}>
              <MessageCircle className="size-5" aria-hidden="true" /> Pedir ayuda por WhatsApp
            </a>
          ) : null}
          {isMp && state === "paid" ? <PaidOrderActions whatsappUrl={message({ paid: true })} /> : null}
          {isMp && state === "failed" ? (
            <Link href="/carrito" className={buttonClasses("primary", "lg")}>
              Volver al carrito
            </Link>
          ) : null}
          {order.payment_method === "efectivo" && order.status === "pending" && whatsapp ? (
            <a
              href={message({ paymentMethod: "efectivo" }) ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("outline", "md")}
            >
              <MessageCircle className="size-4" aria-hidden="true" /> ¿No se envió? Mandar el pedido por WhatsApp
            </a>
          ) : null}
          <p className="text-xs text-muted">
            Guardá esta página para ver cómo sigue tu pedido. También la encontrás en{" "}
            <Link href="/mi-pedido" className="font-semibold text-coral-deep hover:underline">
              Seguir mi pedido
            </Link>
            .
          </p>
          {order.status === "delivered" || order.status === "confirmed" || cancelled ? (
            <BuyAgain
              items={order.items
                .filter((i): i is typeof i & { product_id: string } => Boolean(i.product_id))
                .map((i) => ({ productId: i.product_id, quantity: i.quantity }))}
            />
          ) : null}
          {!cancelled && helpUrl ? (
            <a
              href={helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 text-sm font-semibold text-botanical-deep hover:underline"
            >
              <MessageCircle className="size-4" aria-hidden="true" /> ¿Necesitás ayuda con tu pedido? Escribile a Natu Mariel
            </a>
          ) : null}
          <Link href="/productos" className="text-sm font-semibold text-coral-deep hover:underline">
            Seguir mirando productos
          </Link>
          {canCustomerCancel(order) ? (
            <div className="mt-2 border-t border-line pt-4">
              <CancelOrder orderId={order.id} code={order.code} />
            </div>
          ) : order.status === "pending" ? (
            <p className="mt-2 border-t border-line pt-4 text-xs text-muted">
              ¿Querés cancelar este pedido? Como ya hay un pago de por medio, escribile a Natu Mariel y lo resuelven juntas.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
