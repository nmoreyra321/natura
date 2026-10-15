import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import Link from "next/link";

import { SalesChart, type SalesBar } from "@/components/admin/sales-chart";
import { requireAdmin } from "@/lib/auth";
import { formatARS } from "@/lib/format";
import {
  currentMonth,
  daysInMonth,
  monthLabel,
  monthlyTotals,
  monthStartIso,
  parseMonth,
  percentChange,
  shiftMonth,
  shortMonthLabel,
  summarizeMonth,
  type SalesOrder,
} from "@/lib/sales";

export const metadata = { title: "Ventas" };

const MONTHS_IN_TREND = 6;

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const weekday = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function Delta({ current, previous, previousLabel }: { current: number; previous: number; previousLabel: string }) {
  const change = percentChange(current, previous);
  if (change === null) return <p className="text-sm text-muted">Sin ventas en {previousLabel} para comparar</p>;
  const up = change >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <p className="flex items-center gap-1 text-sm">
      <span className={`inline-flex items-center gap-0.5 font-bold ${up ? "text-botanical-deep" : "text-coral-deep"}`}>
        <Icon className="size-4" aria-hidden="true" />
        {up ? "+" : ""}
        {change}%
      </span>
      <span className="text-muted">vs. {previousLabel}</span>
    </p>
  );
}

export default async function SalesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase } = await requireAdmin();
  const today = currentMonth();
  const sp = await searchParams;
  const month = parseMonth(one(sp.mes), today);
  const isFuture = month > today;
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  const { data, error } = await supabase
    .from("orders")
    .select("status, total, savings, created_at, items:order_items(product_id, name, quantity, unit_price)")
    .gte("created_at", monthStartIso(shiftMonth(month, -(MONTHS_IN_TREND - 1))))
    .lt("created_at", monthStartIso(next))
    .limit(10000);
  const orders = (data ?? []) as SalesOrder[];

  const s = summarizeMonth(orders, month);
  const p = summarizeMonth(orders, prev);
  const prevLabel = monthLabel(prev).replace(/ de \d{4}$/, "").toLowerCase();

  const days: SalesBar[] = s.byDayCents.map((cents, i) => {
    const date = new Date(`${month}-${String(i + 1).padStart(2, "0")}T12:00:00Z`);
    const label = weekday.format(date);
    return { tick: String(i + 1), label: label.charAt(0).toUpperCase() + label.slice(1), cents };
  });
  const months: SalesBar[] = monthlyTotals(orders, month, MONTHS_IN_TREND).map((m) => ({
    tick: shortMonthLabel(m.month),
    label: monthLabel(m.month),
    cents: m.totalCents,
    current: m.month === month,
  }));
  const daysCount = daysInMonth(month);

  const tiles = [
    { label: "Pedidos vendidos", value: String(s.orders), cur: s.orders, prev: p.orders },
    { label: "Ticket promedio", value: formatARS(s.averageCents), cur: s.averageCents, prev: p.averageCents },
    { label: "Unidades", value: String(s.units), cur: s.units, prev: p.units },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Ventas</h1>
          <p className="text-muted">Lo vendido en la tienda web y con Venta rápida (pedidos confirmados y entregados).</p>
        </div>
        <nav aria-label="Elegir mes" className="flex items-center gap-1 rounded-full bg-warm-white p-1 shadow-soft">
          <Link
            href={`/admin/ventas?mes=${prev}`}
            className="inline-flex size-10 items-center justify-center rounded-full hover:bg-sun"
            aria-label={`Ver ${monthLabel(prev)}`}
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
          <span className="min-w-40 text-center font-bold">{monthLabel(month)}</span>
          {next <= today ? (
            <Link
              href={next === today ? "/admin/ventas" : `/admin/ventas?mes=${next}`}
              className="inline-flex size-10 items-center justify-center rounded-full hover:bg-sun"
              aria-label={`Ver ${monthLabel(next)}`}
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </Link>
          ) : (
            <span className="inline-flex size-10" aria-hidden="true" />
          )}
        </nav>
      </div>

      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar las ventas.</p>
      ) : (
        <>
          <section aria-label="Resumen del mes" className="mt-6 grid gap-3 lg:grid-cols-[1.3fr_2fr]">
            <div className="rounded-3xl border-2 border-forest bg-warm-white p-5 shadow-[4px_4px_0_var(--forest)]">
              <p className="text-sm font-semibold text-muted">Vendido en {monthLabel(month).toLowerCase()}</p>
              <p className="mt-1 text-5xl font-extrabold tracking-tight text-forest">{formatARS(s.totalCents)}</p>
              <div className="mt-2">
                <Delta current={s.totalCents} previous={p.totalCents} previousLabel={prevLabel} />
              </div>
              {s.savingsCents > 0 ? (
                <p className="mt-3 text-sm text-muted">
                  Tus clientas ahorraron {formatARS(s.savingsCents)} frente a precio de revista.
                </p>
              ) : null}
            </div>
            <ul className="grid gap-3 sm:grid-cols-3">
              {tiles.map((t) => (
                <li key={t.label} className="flex flex-col gap-1 rounded-3xl bg-warm-white p-4 shadow-soft">
                  <span className="text-sm font-semibold text-muted">{t.label}</span>
                  <span className="text-2xl font-extrabold">{t.value}</span>
                  <Delta current={t.cur} previous={t.prev} previousLabel={prevLabel} />
                </li>
              ))}
            </ul>
          </section>

          {s.pendingOrders > 0 ? (
            <Link
              href="/admin/pedidos"
              className="mt-3 flex items-center gap-3 rounded-3xl bg-sun p-4 font-semibold hover:bg-sun/80"
            >
              <Clock className="size-5 shrink-0" aria-hidden="true" />
              {formatARS(s.pendingCents)} en {s.pendingOrders} {s.pendingOrders === 1 ? "pedido pendiente" : "pedidos pendientes"} de
              confirmar este mes. No se cuentan como venta hasta que los confirmes →
            </Link>
          ) : null}

          {isFuture ? null : (
            <section aria-labelledby="por-dia" className="mt-6 rounded-3xl bg-warm-white p-5 shadow-soft">
              <h2 id="por-dia" className="font-display text-xl font-bold">
                Ventas por día
              </h2>
              <p className="mb-6 text-sm text-muted">Tocá una barra para ver el detalle.</p>
              <SalesChart bars={days} title={`Ventas por día de ${monthLabel(month)}`} tickEvery={daysCount > 28 ? 5 : 7} />
            </section>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section aria-labelledby="por-mes" className="rounded-3xl bg-warm-white p-5 shadow-soft">
              <h2 id="por-mes" className="font-display text-xl font-bold">
                Últimos {MONTHS_IN_TREND} meses
              </h2>
              <p className="mb-6 text-sm text-muted">El mes elegido aparece resaltado.</p>
              <SalesChart bars={months} title={`Ventas de los últimos ${MONTHS_IN_TREND} meses`} />
            </section>

            <section aria-labelledby="mas-vendidos" className="rounded-3xl bg-warm-white p-5 shadow-soft">
              <h2 id="mas-vendidos" className="font-display text-xl font-bold">
                Lo más vendido del mes
              </h2>
              {s.topProducts.length === 0 ? (
                <p className="mt-3 text-muted">
                  Todavía no hay ventas este mes. Cuando confirmes pedidos, vas a ver acá los productos que más se venden.
                </p>
              ) : (
                <ol className="mt-3 flex flex-col">
                  {s.topProducts.map((t, i) => (
                    <li key={t.key} className="flex items-baseline gap-3 border-b border-line/60 py-2 last:border-b-0">
                      <span className="w-5 shrink-0 text-right text-sm font-bold text-muted tabular">{i + 1}</span>
                      <span className="min-w-0 flex-1 text-sm font-semibold">{t.name}</span>
                      <span className="shrink-0 text-sm text-muted tabular">{t.units} u.</span>
                      <span className="w-28 shrink-0 text-right text-sm font-bold tabular">{formatARS(t.totalCents)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <p className="mt-6 text-sm text-muted">
            ¿Buscás un pedido en particular (código, clienta o teléfono)? Está en{" "}
            <Link href="/admin/pedidos?estado=todos" className="font-semibold text-coral-deep hover:underline">
              Pedidos
            </Link>
            .
          </p>

          {s.cancelledOrders > 0 ? (
            <p className="mt-4 text-sm text-muted">
              Este mes hubo {s.cancelledOrders} {s.cancelledOrders === 1 ? "pedido cancelado" : "pedidos cancelados"}, que no suman.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
