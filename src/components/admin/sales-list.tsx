import { ExternalLink, MessageCircle, Search } from "lucide-react";
import Link from "next/link";

import { isManualSale, originLabel } from "@/lib/channels";
import { formatPhone, toWhatsAppPhone } from "@/lib/debts";
import { formatARS } from "@/lib/format";

export type SaleRow = {
  id: string;
  code: string;
  createdAt: string;
  customerName: string | null;
  customerPhone: string | null;
  channel: string;
  status: string;
  totalCents: number;
  paidCents: number;
  paymentMethod: string;
  units: number;
};

const STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pendiente", tone: "bg-sun text-forest" },
  confirmed: { label: "Confirmado", tone: "bg-sage text-botanical-deep" },
  delivered: { label: "Entregado", tone: "bg-lilac text-grape" },
};
const PAYMENT: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia", mercadopago: "Mercado Pago" };

const dateFmt = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

const ORIGINS = [
  { value: "", label: "Todas" },
  { value: "web", label: "Tienda web" },
  { value: "rapida", label: "Venta rápida" },
];

/** Listado de las ventas del mes: código, clienta, teléfono, de dónde vino, cobro y total. */
export function SalesList({
  rows,
  month,
  origin,
  q,
}: {
  rows: SaleRow[];
  month: string;
  origin: string;
  q: string;
}) {
  const link = (o: string) => {
    const p = new URLSearchParams({ mes: month });
    if (o) p.set("origen", o);
    if (q) p.set("q", q);
    return `/admin/ventas?${p.toString()}#listado`;
  };
  const totalCents = rows.filter((r) => r.status !== "pending").reduce((s, r) => s + r.totalCents, 0);

  return (
    <section id="listado" aria-labelledby="listado-titulo" className="mt-6 scroll-mt-24 rounded-3xl bg-warm-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="listado-titulo" className="font-display text-xl font-bold">
            Listado de ventas
          </h2>
          <p className="text-sm text-muted">
            {rows.length} {rows.length === 1 ? "venta" : "ventas"}
            {rows.length ? ` · ${formatARS(totalCents)} vendido (sin contar pendientes)` : ""}
          </p>
        </div>
        <form method="get" action="/admin/ventas#listado" className="flex gap-2">
          <input type="hidden" name="mes" value={month} />
          {origin ? <input type="hidden" name="origen" value={origin} /> : null}
          <label htmlFor="vq" className="sr-only">
            Buscar venta
          </label>
          <input
            id="vq"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Código, nombre o teléfono"
            className="h-10 w-56 rounded-full border border-line bg-white px-4 text-sm focus:border-botanical focus:outline-none"
          />
          <button type="submit" className="inline-flex size-10 items-center justify-center rounded-full bg-botanical-deep text-white" aria-label="Buscar">
            <Search className="size-4" aria-hidden="true" />
          </button>
        </form>
      </div>

      <nav aria-label="Filtrar por origen" className="mt-3 flex flex-wrap gap-1.5">
        {ORIGINS.map((o) => (
          <Link
            key={o.value}
            href={link(o.value)}
            aria-current={origin === o.value ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-bold ${origin === o.value ? "bg-forest text-white" : "bg-cream text-forest hover:bg-sun"}`}
          >
            {o.label}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-cream p-4 text-sm text-muted">
          {q ? `No hay ventas con “${q}” este mes.` : "No hay ventas para mostrar este mes."}
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs font-bold tracking-wide text-muted uppercase">
                <th className="py-2 pr-3">Código</th>
                <th className="py-2 pr-3">Fecha</th>
                <th className="py-2 pr-3">Clienta</th>
                <th className="py-2 pr-3">Teléfono</th>
                <th className="py-2 pr-3">Origen</th>
                <th className="py-2 pr-3">Estado y cobro</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const wa = toWhatsAppPhone(r.customerPhone);
                const status = STATUS[r.status] ?? STATUS.pending;
                const owed = r.totalCents - r.paidCents;
                return (
                  <tr key={r.id} className="border-b border-line/60 align-top last:border-b-0 hover:bg-cream/50">
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/admin/pedidos?q=${encodeURIComponent(r.code)}`}
                        className="inline-flex items-center gap-1 font-mono font-bold whitespace-nowrap text-coral-deep hover:underline"
                        title="Ver el pedido"
                      >
                        {r.code} <ExternalLink className="size-3.5" aria-hidden="true" />
                      </Link>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap text-muted tabular">{dateFmt.format(new Date(r.createdAt))}</td>
                    <td className="py-2.5 pr-3">
                      <span className="font-semibold">{r.customerName || <span className="font-normal text-muted">Sin nombre</span>}</span>
                      <span className="block text-xs text-muted">
                        {r.units} {r.units === 1 ? "unidad" : "unidades"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 whitespace-nowrap tabular">
                      {wa ? (
                        <a
                          href={`https://wa.me/${wa}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold text-botanical-deep hover:underline"
                        >
                          <MessageCircle className="size-3.5" aria-hidden="true" />
                          {formatPhone(r.customerPhone)}
                        </a>
                      ) : (
                        <span className="text-muted">{r.customerPhone || "—"}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${isManualSale(r.channel) ? "bg-peach text-forest" : "bg-blush text-coral-deep"}`}
                      >
                        {originLabel(r.channel)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${status.tone}`}>{status.label}</span>
                      <span className="block text-xs text-muted">
                        {PAYMENT[r.paymentMethod] ?? r.paymentMethod}
                        {owed > 0 ? ` · debe ${formatARS(owed)}` : " · cobrado"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-bold whitespace-nowrap tabular">{formatARS(r.totalCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
