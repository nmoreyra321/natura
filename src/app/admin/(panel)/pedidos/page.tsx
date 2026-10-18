import { CirclePlus, ClipboardList } from "lucide-react";
import Link from "next/link";

import type { OrderStatus } from "@/app/admin/actions";
import { CancelledOrders } from "@/components/admin/cancelled-orders";
import { OrderCard } from "@/components/admin/order-card";
import { buttonClasses } from "@/components/ui/button";
import { SelectToDelete } from "@/components/admin/select-to-delete";
import { requireAdmin } from "@/lib/auth";
import { cleanSearch, isManualSale, originLabel } from "@/lib/channels";
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

/** En qué parte de la lista va cada pedido. */
const SECTIONS = [
  { key: "todo", title: "Para hacer ahora" },
  { key: "entrega", title: "Esperando que lo entregues" },
  { key: "listo", title: "Terminados" },
  { key: "cancelado", title: "Cancelados" },
] as const;

function sectionOf(o: Parameters<typeof needsPaymentReview>[0]): (typeof SECTIONS)[number]["key"] {
  if (o.status === "cancelled") return "cancelado";
  if (o.status === "delivered") return "listo";
  if (o.status === "confirmed" && !needsPaymentReview(o)) return "entrega";
  return "todo";
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
      "id, number, code, channel, status, customer_cancelled_at, customer_user_id, delivery_method, shipping_zone, shipping_address, shipping_cost, customer_name, customer_phone, total, savings, created_at, payment_method, payment_status, mp_net_received, paid_at, amount_paid, payment_note, payment_reported_at, payment_rejection, payment_proof_path, items:order_items(id, product_id, name, size, quantity, unit_price), lots:order_lot_allocations(product_id, expires_on, quantity)",
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
          {SECTIONS.map((sec) => {
            const rows = orders.filter((o) => sectionOf(o) === sec.key);
            if (rows.length === 0) return null;
            return (
              <section key={sec.key} aria-label={sec.title} className="mt-6">
                <h2 className="mb-3 flex items-center gap-2 font-display text-xl font-bold">
                  <span className={`inline-flex min-w-7 items-center justify-center rounded-full px-2 text-base ${sec.key === "todo" ? "bg-coral-deep text-white" : "bg-line text-muted"}`}>
                    {rows.length}
                  </span>{" "}
                  {sec.title}
                </h2>
                <ul className="flex flex-col gap-4">
                  {rows.map((o) => {
                    const status = (o.status in STATUS_LABELS ? o.status : "pending") as OrderStatus;
                    const review = needsPaymentReview(o);
                    // Pago online (transferencia) sin confirmar: un solo botón «Ya me llegó».
                    const onlineUnpaid = o.payment_method === "transferencia" && status !== "cancelled" && paymentState(o) !== "paid";
                    return (
                      <li key={o.id}>
                        <OrderCard
                          id={o.id}
                          code={o.code}
                          number={o.number}
                          status={status}
                          cancelledByCustomer={Boolean(o.customer_cancelled_at)}
                          originLabel={isManualSale(o.channel) ? originLabel(o.channel) : null}
                          withAccount={Boolean(o.customer_user_id)}
                          delivery={{
                            method: o.delivery_method === "envio" ? "envio" : "retiro",
                            zone: o.shipping_zone,
                            address: o.shipping_address,
                            shippingCents: toCents(o.shipping_cost),
                          }}
                          name={o.customer_name}
                          phone={o.customer_phone}
                          trackUrl={`${siteUrl}/pedido/${o.id}`}
                          paymentMethod={o.payment_method}
                          paymentStatus={o.payment_status}
                          onlineUnpaid={onlineUnpaid}
                          review={review}
                          reportedAtLabel={o.payment_reported_at ? dateFormatter.format(new Date(o.payment_reported_at)) : null}
                          createdLabel={dateFormatter.format(new Date(o.created_at))}
                          totalCents={toCents(o.total)}
                          paidCents={toCents(o.amount_paid)}
                          netReceivedCents={o.mp_net_received === null ? null : toCents(o.mp_net_received)}
                          paymentNote={o.payment_note}
                          paymentRejection={o.payment_rejection}
                          items={o.items.map((i) => ({
                            id: i.id,
                            name: i.name,
                            size: i.size,
                            quantity: i.quantity,
                            lots: o.lots.some((l) => l.product_id === i.product_id)
                              ? o.lots
                                  .filter((l) => l.product_id === i.product_id)
                                  .map((l) => `${l.quantity} u. vto. ${formatExpiry(l.expires_on)}`)
                                  .join(", ")
                              : null,
                          }))}
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
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
