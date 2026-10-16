import { CirclePlus, ClipboardList } from "lucide-react";
import Link from "next/link";

import type { OrderStatus } from "@/app/admin/actions";
import { CancelledOrders } from "@/components/admin/cancelled-orders";
import { OrderActions, PaymentControl } from "@/components/admin/order-actions";
import { buttonClasses } from "@/components/ui/button";
import { OrderContact } from "@/components/admin/order-contact";
import { PaymentReview } from "@/components/admin/payment-review";
import { SelectBox, SelectToDelete } from "@/components/admin/select-to-delete";
import { requireAdmin } from "@/lib/auth";
import { cleanSearch, originLabel } from "@/lib/channels";
import { formatARS } from "@/lib/format";
import { getSiteUrl } from "@/lib/config";
import { formatExpiry } from "@/lib/lots";
import { needsPaymentReview, paymentState } from "@/lib/order-tracking";
import { toCents } from "@/lib/pricing";

export const metadata = { title: "Pedidos" };

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<OrderStatus, { label: string; tone: string }> = {
  pending: { label: "Pendiente", tone: "bg-sun text-forest" },
  confirmed: { label: "Confirmado", tone: "bg-sage text-botanical-deep" },
  delivered: { label: "Entregado", tone: "bg-lilac text-grape" },
  cancelled: { label: "Cancelado", tone: "bg-cream text-muted" },
};

const PAYMENT_LABELS: Record<string, { label: string; tone: string }> = {
  approved: { label: "Mercado Pago · Pagado", tone: "bg-[#009ee3] text-white" },
  pending: { label: "Mercado Pago · Esperando pago", tone: "bg-[#e6f6fd] text-[#00649a]" },
  in_process: { label: "Mercado Pago · Pago en revisión", tone: "bg-[#e6f6fd] text-[#00649a]" },
  rejected: { label: "Mercado Pago · Rechazado", tone: "bg-coral-soft text-coral-deep" },
  cancelled: { label: "Mercado Pago · No pagó", tone: "bg-cream text-muted" },
  refunded: { label: "Mercado Pago · Devuelto", tone: "bg-cream text-muted" },
  charged_back: { label: "Mercado Pago · Pago reclamado", tone: "bg-coral-soft text-coral-deep" },
};

function paymentBadge(method: string, status: string | null, paidCents = 0, totalCents = 0, review = false) {
  if (method !== "mercadopago") {
    const label = method === "transferencia" ? "Transferencia / link MP" : "Efectivo";
    if (status === "approved") return { label: `${label} · Pagado ✓`, tone: "bg-botanical-deep text-white" };
    if (review) return { label: `${label} · Avisó que pagó: revisar`, tone: "bg-grape text-white" };
    if (paidCents > 0) {
      return { label: `${label} · Pagó una parte (falta ${formatARS(totalCents - paidCents)})`, tone: "bg-sun text-forest" };
    }
    return { label: `${label} · Sin cobrar`, tone: "bg-coral-soft text-coral-deep" };
  }
  return PAYMENT_LABELS[status ?? "pending"] ?? PAYMENT_LABELS.pending;
}


// "atender" (lo que hay que hacer) es lo que se ve al entrar.
const FILTERS: { value: string; label: string }[] = [
  { value: "atender", label: "Por atender" },
  { value: "confirmed", label: "Confirmados" },
  { value: "delivered", label: "Entregados" },
  { value: "cancelled", label: "Cancelados" },
  { value: "todos", label: "Todos" },
];

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

function href(estado: string, page: number, q = "") {
  const params = new URLSearchParams();
  if (estado && estado !== "atender") params.set("estado", estado);
  if (q) params.set("q", q);
  if (page > 1) params.set("pagina", String(page));
  const qs = params.toString();
  return qs ? `/admin/pedidos?${qs}` : "/admin/pedidos";
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const q = cleanSearch(one(sp.q));
  // Por defecto, lo que hay que atender; al buscar, en todos. (pending/revisar/sin-cobrar son direcciones viejas.)
  const raw = { pending: "atender", revisar: "atender", "sin-cobrar": "todos" }[one(sp.estado)] ?? one(sp.estado);
  const estado = FILTERS.some((f) => f.value === raw) ? raw : q ? "todos" : "atender";
  const pageRaw = Number(one(sp.pagina) || "1");
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 && pageRaw <= 10000 ? pageRaw : 1;
  const from = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from("orders")
    .select(
      "id, number, code, channel, status, customer_cancelled_at, customer_user_id, delivery_method, shipping_zone, shipping_address, shipping_cost, customer_name, customer_phone, total, savings, created_at, payment_method, payment_status, paid_at, amount_paid, payment_note, payment_reported_at, payment_rejection, payment_proof_path, items:order_items(id, product_id, name, size, quantity, unit_price), lots:order_lot_allocations(product_id, expires_on, quantity)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id");
  if (estado === "atender") {
    // Pedidos nuevos sin confirmar y pagos que la clienta avisó y falta confirmar.
    query = query.neq("status", "cancelled").or("status.eq.pending,payment_reported_at.not.is.null");
  } else if (estado !== "todos") {
    query = query.eq("status", estado);
  }
  if (q) {
    // Por código (NM-…), nombre o teléfono.
    const digits = q.replace(/\D/g, "");
    const like = `%${q}%`;
    query = query.or(
      [`code.ilike.${like}`, `customer_name.ilike.${like}`, ...(digits.length >= 4 ? [`customer_phone.ilike.%${digits}%`] : [])].join(","),
    );
  }
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  const orders = error?.code === "PGRST103" ? [] : (data ?? []);
  const total = count ?? 0;
  const pageCount = Math.ceil(total / PAGE_SIZE);

  // Enlaces (por 1 hora) para ver los comprobantes de los pagos por revisar.
  const proofPaths = orders.filter((o) => needsPaymentReview(o) && o.payment_proof_path).map((o) => o.payment_proof_path!);
  const proofUrls = new Map<string, string>();
  if (proofPaths.length > 0) {
    const { data: signed } = await supabase.storage.from("payment-proofs").createSignedUrls(proofPaths, 3600);
    for (const x of signed ?? []) if (x.path && x.signedUrl) proofUrls.set(x.path, x.signedUrl);
  }
  const siteUrl = getSiteUrl();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Pedidos</h1>
        <Link href="/admin/vender" className={buttonClasses("primary", "md")}>
          <CirclePlus className="size-4" aria-hidden="true" /> Venta rápida
        </Link>
      </div>
      <p className="text-muted">
        Acá llegan los pedidos de la tienda y las ventas rápidas. Al confirmar un pedido se descuenta el stock.
      </p>

      <nav aria-label="Filtrar por estado" className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={href(f.value, 1, q)}
            aria-current={estado === f.value ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-bold ${estado === f.value ? "bg-forest text-white" : "bg-warm-white shadow-soft hover:bg-sun"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <form method="get" className="mt-3 flex gap-2">
        {/* La búsqueda es siempre en todos los pedidos. */}
        <input type="hidden" name="estado" value="todos" />
        <label htmlFor="pq" className="sr-only">
          Buscar pedido
        </label>
        <input
          id="pq"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar por código (NM-…), nombre o teléfono"
          className="h-10 w-full max-w-md rounded-full border border-line bg-white px-4 text-sm focus:border-botanical focus:outline-none"
        />
        <button type="submit" className={buttonClasses("secondary", "sm")}>
          Buscar
        </button>
        {q ? (
          <Link href={href(estado, 1)} className="self-center text-sm font-semibold text-coral-deep hover:underline">
            Limpiar
          </Link>
        ) : null}
      </form>

      {error && error.code !== "PGRST103" ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar los pedidos.</p>
      ) : orders.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line bg-warm-white p-10 text-center">
          <ClipboardList className="mx-auto size-10 text-muted" aria-hidden="true" />
          <p className="mt-3 font-display text-xl font-bold">
            {q
              ? `No hay pedidos con “${q}”.`
              : estado === "atender"
                ? "No hay nada por atender. ¡Todo al día! 🎉"
                : estado === "todos"
                  ? "Todavía no hay pedidos."
                  : "No hay pedidos con este estado."}
          </p>
          {estado === "atender" && !q ? (
            <p className="mt-1 text-muted">Cuando una clienta haga un pedido o avise que pagó, lo vas a ver acá.</p>
          ) : null}
        </div>
      ) : estado === "cancelled" ? (
        <CancelledOrders
          rows={orders.map((o) => ({
            id: o.id,
            code: o.code,
            date: dateFormatter.format(new Date(o.created_at)),
            customer: o.customer_name,
            total: formatARS(toCents(o.total)),
            units: o.items.reduce((sum, i) => sum + i.quantity, 0),
          }))}
        />
      ) : (
        <SelectToDelete kind="orders" ids={orders.map((o) => o.id)}>
        <ul className="mt-6 flex flex-col gap-4">
          {orders.map((o) => {
            const status = (o.status in STATUS_LABELS ? o.status : "pending") as OrderStatus;
            const units = o.items.reduce((sum, i) => sum + i.quantity, 0);
            const review = needsPaymentReview(o);
            // Pago online (link de Mercado Pago o transferencia) sin confirmar: un solo botón «Confirmar pago».
            const onlineUnpaid =
              o.payment_method === "transferencia" && status !== "cancelled" && paymentState(o) !== "paid";
            const badge = paymentBadge(o.payment_method, o.payment_status, toCents(o.amount_paid), toCents(o.total), review);
            return (
              <li key={o.id} className="rounded-3xl bg-warm-white p-4 shadow-soft sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2">
                      <SelectBox id={o.id} label={`el pedido ${o.code}`} />
                      <span className="font-display text-xl font-bold">Pedido {o.code}</span>
                      <span className="text-sm text-muted tabular">Pedido n.º {o.number}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_LABELS[status].tone}`}>
                        {status === "cancelled" && o.customer_cancelled_at ? "Cancelado por la clienta" : STATUS_LABELS[status].label}
                      </span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${badge.tone}`}>{badge.label}</span>
                      <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-bold text-muted">
                        {originLabel(o.channel)}
                      </span>
                      {o.customer_user_id ? (
                        <span className="rounded-full bg-sage px-2.5 py-0.5 text-xs font-bold text-botanical-deep" title="Hecho con cuenta de clienta: suma al Club">
                          👤 Con cuenta · suma al Club
                        </span>
                      ) : null}
                    </p>
                    {o.delivery_method === "envio" ? (
                      <p className="mt-1 rounded-2xl bg-sage/60 px-3 py-1.5 text-sm">
                        🚚 <b>Envío a {o.shipping_zone}</b> ({formatARS(toCents(o.shipping_cost))}, incluido en el total):{" "}
                        {o.shipping_address}
                      </p>
                    ) : null}
                    <OrderContact
                      orderId={o.id}
                      code={o.code}
                      name={o.customer_name}
                      phone={o.customer_phone}
                      status={status}
                      delivery={o.delivery_method}
                      zone={o.shipping_zone}
                      trackUrl={`${siteUrl}/pedido/${o.id}`}
                    />
                    <p className="text-sm text-muted">
                      {dateFormatter.format(new Date(o.created_at))} · {units} {units === 1 ? "unidad" : "unidades"}
                      {o.paid_at ? ` · Cobrado el ${dateFormatter.format(new Date(o.paid_at))}` : ""}
                    </p>
                  </div>
                  <p className="text-right tabular">
                    <span className="block text-2xl font-extrabold text-coral-deep">{formatARS(toCents(o.total))}</span>
                    {Number(o.savings) > 0 ? (
                      <span className="text-xs text-muted">Ahorro: {formatARS(toCents(o.savings))}</span>
                    ) : null}
                  </p>
                </div>
                <ul className="mt-3 divide-y divide-line/70 rounded-2xl border border-line/70 text-sm">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex justify-between gap-3 px-3 py-2">
                      <span className="min-w-0">
                        <span className="font-bold tabular">{i.quantity} ×</span> {i.name}
                        {i.size ? <span className="text-muted"> ({i.size})</span> : null}
                        {o.lots.some((l) => l.product_id === i.product_id) ? (
                          <span className="block text-xs text-muted">
                            Salió de:{" "}
                            {o.lots
                              .filter((l) => l.product_id === i.product_id)
                              .map((l) => `${l.quantity} u. vto. ${formatExpiry(l.expires_on)}`)
                              .join(", ")}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 tabular">{formatARS(toCents(i.unit_price) * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
                {onlineUnpaid ? (
                  <div className="mt-3">
                    <PaymentReview
                      orderId={o.id}
                      code={o.code}
                      name={o.customer_name}
                      phone={o.customer_phone}
                      total={formatARS(toCents(o.total) - toCents(o.amount_paid))}
                      reportedAt={review ? dateFormatter.format(new Date(o.payment_reported_at!)) : null}
                      proofUrl={o.payment_proof_path ? (proofUrls.get(o.payment_proof_path) ?? null) : null}
                      proofIsPdf={o.payment_proof_path?.endsWith(".pdf") ?? false}
                      trackUrl={`${siteUrl}/pedido/${o.id}`}
                    />
                  </div>
                ) : null}
                {onlineUnpaid && o.payment_rejection && !review ? (
                  <p className="mt-3 rounded-2xl bg-coral-soft px-3 py-2 text-sm">
                    <span className="font-semibold">Pago no confirmado:</span> {o.payment_rejection}. Esperando que la clienta
                    vuelva a avisar.
                  </p>
                ) : null}
                {o.payment_note && o.payment_status !== "approved" ? (
                  <p className="mt-3 rounded-2xl bg-sun/40 px-3 py-2 text-sm">
                    <span className="font-semibold">Nota del cobro:</span> {o.payment_note}
                  </p>
                ) : null}
                {o.payment_method === "efectivo" && status !== "cancelled" ? (
                  <div className="mt-3">
                    <PaymentControl
                      key={`${o.amount_paid}-${o.total}`}
                      id={o.id}
                      totalCents={toCents(o.total)}
                      paidCents={toCents(o.amount_paid)}
                    />
                  </div>
                ) : null}
                <div className="mt-3">
                  <OrderActions id={o.id} code={o.code} status={status} hideConfirm={onlineUnpaid} />
                </div>
              </li>
            );
          })}
        </ul>
        </SelectToDelete>
      )}

      {pageCount > 1 && orders.length > 0 ? (
        <nav aria-label="Paginación" className="mt-8 flex items-center justify-center gap-3">
          {page > 1 ? (
            <Link href={href(estado, page - 1, q)} className={buttonClasses("outline")}>
              Anterior
            </Link>
          ) : null}
          <span className="text-sm text-muted tabular">
            Página {page} de {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={href(estado, page + 1, q)} className={buttonClasses("outline")}>
              Siguiente
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
