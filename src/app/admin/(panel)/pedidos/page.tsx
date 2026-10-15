import { CirclePlus, ClipboardList } from "lucide-react";
import Link from "next/link";

import type { OrderStatus } from "@/app/admin/actions";
import { CancelledOrders } from "@/components/admin/cancelled-orders";
import { OrderActions, PaymentControl } from "@/components/admin/order-actions";
import { buttonClasses } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { cleanSearch, originLabel } from "@/lib/channels";
import { formatARS } from "@/lib/format";
import { formatExpiry } from "@/lib/lots";
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
  in_process: { label: "Mercado Pago · En proceso", tone: "bg-[#e6f6fd] text-[#00649a]" },
  rejected: { label: "Mercado Pago · Rechazado", tone: "bg-coral-soft text-coral-deep" },
  cancelled: { label: "Mercado Pago · No pagó", tone: "bg-cream text-muted" },
  refunded: { label: "Mercado Pago · Devuelto", tone: "bg-cream text-muted" },
  charged_back: { label: "Mercado Pago · Contracargo", tone: "bg-coral-soft text-coral-deep" },
};

function paymentBadge(method: string, status: string | null, paidCents = 0, totalCents = 0) {
  if (method !== "mercadopago") {
    const label = method === "transferencia" ? "Transferencia" : "Efectivo";
    if (status === "approved") return { label: `${label} · Pagado ✓`, tone: "bg-botanical-deep text-white" };
    if (paidCents > 0) {
      return { label: `${label} · Pagó una parte (falta ${formatARS(totalCents - paidCents)})`, tone: "bg-sun text-forest" };
    }
    return { label: `${label} · Sin cobrar`, tone: "bg-coral-soft text-coral-deep" };
  }
  return PAYMENT_LABELS[status ?? "pending"] ?? PAYMENT_LABELS.pending;
}


const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "pending", label: "Pendientes" },
  { value: "confirmed", label: "Confirmados" },
  { value: "delivered", label: "Entregados" },
  { value: "cancelled", label: "Cancelados" },
  { value: "sin-cobrar", label: "Sin cobrar" },
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
  if (estado) params.set("estado", estado);
  if (q) params.set("q", q);
  if (page > 1) params.set("pagina", String(page));
  const qs = params.toString();
  return qs ? `/admin/pedidos?${qs}` : "/admin/pedidos";
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const estado = one(sp.estado) in STATUS_LABELS || one(sp.estado) === "sin-cobrar" ? one(sp.estado) : "";
  const pageRaw = Number(one(sp.pagina) || "1");
  const page = Number.isInteger(pageRaw) && pageRaw >= 1 && pageRaw <= 10000 ? pageRaw : 1;
  const from = (page - 1) * PAGE_SIZE;
  const q = cleanSearch(one(sp.q));

  let query = supabase
    .from("orders")
    .select(
      "id, number, code, channel, status, customer_name, total, savings, created_at, payment_method, payment_status, paid_at, amount_paid, payment_note, items:order_items(id, product_id, name, size, quantity, unit_price), lots:order_lot_allocations(product_id, expires_on, quantity)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id");
  if (estado === "sin-cobrar") {
    // Pedidos vigentes cuyo pago todavía no se marcó (o Mercado Pago no aprobó).
    query = query.neq("status", "cancelled").or("payment_status.is.null,payment_status.neq.approved");
  } else if (estado) {
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

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">Pedidos</h1>
        <Link href="/admin/vender" className={buttonClasses("primary", "md")}>
          <CirclePlus className="size-4" aria-hidden="true" /> Venta rápida
        </Link>
      </div>
      <p className="text-muted">
        Cada pedido que una clienta envía por WhatsApp queda acá. Al confirmarlo se descuenta el stock.
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
        {estado ? <input type="hidden" name="estado" value={estado} /> : null}
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
            {q ? `No hay pedidos con “${q}”.` : estado ? "No hay pedidos con este estado." : "Todavía no hay pedidos."}
          </p>
          {!estado && !q ? (
            <p className="mt-1 text-muted">Cuando una clienta envíe un pedido por WhatsApp, lo vas a ver acá.</p>
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
        <ul className="mt-6 flex flex-col gap-4">
          {orders.map((o) => {
            const status = (o.status in STATUS_LABELS ? o.status : "pending") as OrderStatus;
            const units = o.items.reduce((sum, i) => sum + i.quantity, 0);
            return (
              <li key={o.id} className="rounded-3xl bg-warm-white p-4 shadow-soft sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-xl font-bold">Pedido {o.code}</span>
                      <span className="text-sm text-muted tabular">N.º interno {o.number}</span>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_LABELS[status].tone}`}>
                        {STATUS_LABELS[status].label}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${paymentBadge(o.payment_method, o.payment_status, toCents(o.amount_paid), toCents(o.total)).tone}`}
                      >
                        {paymentBadge(o.payment_method, o.payment_status, toCents(o.amount_paid), toCents(o.total)).label}
                      </span>
                      <span className="rounded-full border border-line px-2.5 py-0.5 text-xs font-bold text-muted">
                        {originLabel(o.channel)}
                      </span>
                    </p>
                    <p className="text-sm text-muted">
                      {dateFormatter.format(new Date(o.created_at))}
                      {o.customer_name ? ` · ${o.customer_name}` : ""} · {units} {units === 1 ? "unidad" : "unidades"}
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
                {o.payment_note && o.payment_status !== "approved" ? (
                  <p className="mt-3 rounded-2xl bg-sun/40 px-3 py-2 text-sm">
                    <span className="font-semibold">Nota del cobro:</span> {o.payment_note}
                  </p>
                ) : null}
                {o.payment_method !== "mercadopago" && status !== "cancelled" ? (
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
                  <OrderActions id={o.id} code={o.code} status={status} />
                </div>
              </li>
            );
          })}
        </ul>
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
