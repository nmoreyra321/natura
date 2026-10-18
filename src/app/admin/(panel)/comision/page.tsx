import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { UpdateFeeButton } from "@/components/admin/update-fee-button";
import { requireAdmin } from "@/lib/auth";
import { formatARS } from "@/lib/format";
import { runningResult, summarizeMpFees } from "@/lib/mp-fees";
import { currentMonth, monthLabel, monthStartIso, parseMonth, shiftMonth } from "@/lib/sales";
import { getMercadoPagoSurcharge } from "@/lib/store-settings";

export const metadata = { title: "Comisión de Mercado Pago" };

type Search = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const day = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "America/Argentina/Buenos_Aires" });
const pct = (n: number) => `${String(n).replace(".", ",")} %`;

export default async function CommissionPage({ searchParams }: { searchParams: Promise<Search> }) {
  const { supabase } = await requireAdmin();
  const today = currentMonth();
  const sp = await searchParams;
  const month = parseMonth(one(sp.mes), today);
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);

  const [{ data, error }, percent] = await Promise.all([
    supabase
      .from("orders")
      .select("code, customer_name, created_at, total, mp_net_received")
      .eq("payment_method", "mercadopago")
      .eq("payment_status", "approved")
      .gte("created_at", monthStartIso(month))
      .lt("created_at", monthStartIso(next))
      .order("created_at", { ascending: true }),
    getMercadoPagoSurcharge(),
  ]);
  if (error) throw new Error("No se pudieron cargar los pagos");

  const s = summarizeMpFees(data ?? [], percent);
  const rows = runningResult(data ?? []);
  const lost = s.resultCents < 0;
  const needsRaise = s.suggestedPercent !== null && s.suggestedPercent > percent;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold">Comisión de Mercado Pago</h1>
      <p className="mt-1 text-muted">Para saber si el recargo alcanza o si Mercado Pago te está sacando plata.</p>

      <div className="mt-4 rounded-3xl bg-warm-white p-4 shadow-soft">
        <p className="mb-3 text-sm font-semibold">
          Mira lo que Mercado Pago cobró en tus últimos pagos y deja el recargo justo para no perder (hoy: {pct(percent)}).
        </p>
        <UpdateFeeButton />
      </div>

      <div className="mt-4 flex items-center justify-between rounded-2xl bg-warm-white p-2 shadow-soft">
        <Link href={`?mes=${prev}`} aria-label="Mes anterior" className="flex size-10 items-center justify-center rounded-full hover:bg-cream">
          <ChevronLeft className="size-5" aria-hidden="true" />
        </Link>
        <span className="font-display text-lg font-bold">{monthLabel(month)}</span>
        {month < today ? (
          <Link href={`?mes=${next}`} aria-label="Mes siguiente" className="flex size-10 items-center justify-center rounded-full hover:bg-cream">
            <ChevronRight className="size-5" aria-hidden="true" />
          </Link>
        ) : (
          <span className="size-10" />
        )}
      </div>

      {s.count === 0 ? (
        <p className="mt-6 rounded-3xl bg-warm-white p-5 text-center font-semibold shadow-soft">
          Este mes todavía no hay pagos con Mercado Pago para mostrar.
        </p>
      ) : (
        <>
          <section
            className={`mt-4 rounded-3xl p-5 shadow-soft ${lost ? "bg-coral/15 ring-1 ring-coral-deep/40" : "bg-botanical/15 ring-1 ring-botanical-deep/40"}`}
          >
            <p className="flex items-center gap-2 text-sm font-bold">
              {lost ? <ArrowDownRight className="size-5 text-coral-deep" aria-hidden="true" /> : <ArrowUpRight className="size-5 text-botanical-deep" aria-hidden="true" />}
              {lost ? "Este mes estás perdiendo" : "Este mes estás ganando"}
            </p>
            <p className="mt-1 font-display text-4xl font-bold">{formatARS(Math.abs(s.resultCents))}</p>
            <p className="mt-1 text-sm">
              {lost
                ? "Es lo que te falta para llegar al precio de los pedidos: la comisión fue más que el recargo."
                : "Es lo que te sobró: el recargo cubrió la comisión de Mercado Pago."}
            </p>
          </section>

          {needsRaise ? (
            <p className="mt-3 rounded-2xl bg-sun/40 p-4 font-semibold">
              ⚠️ Mercado Pago cobra más de lo que cubre el recargo. Conviene subirlo de {pct(percent)} a {pct(s.suggestedPercent!)} en{" "}
              <Link href="/admin/configuracion" className="underline">
                Configuración
              </Link>
              .
            </p>
          ) : (
            <p className="mt-3 rounded-2xl bg-warm-white p-4 font-semibold shadow-soft">✅ El recargo de {pct(percent)} alcanza. No hace falta cambiarlo.</p>
          )}

          <dl className="mt-4 grid grid-cols-2 gap-3">
            {[
              ["Pagos con Mercado Pago", String(s.count)],
              ["Recargo cobrado a clientas", formatARS(s.surchargeCents)],
              ["Comisión de Mercado Pago", formatARS(s.feeCents)],
              ["Comisión real", s.feePercent === null ? "—" : pct(s.feePercent)],
              ["Recargo actual", pct(percent)],
              ["Pedidos que dejaron menos", String(s.shortCount)],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-warm-white p-4 shadow-soft">
                <dt className="text-xs font-bold text-muted">{k}</dt>
                <dd className="mt-1 font-display text-xl font-bold">{v}</dd>
              </div>
            ))}
          </dl>
          <section className="mt-6">
            <h2 className="font-display text-xl font-bold">Cómo vas sumando en {monthLabel(month).toLowerCase()}</h2>
            <ul className="mt-3 overflow-hidden rounded-3xl bg-warm-white shadow-soft">
              {[...rows].reverse().map(({ order: o, resultCents, runningCents }) => (
                <li key={o.code} className="flex items-center gap-3 border-b border-line/60 px-4 py-3 last:border-b-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold">{o.customer_name ?? o.code}</span>
                    <span className="block text-xs text-muted">
                      {day.format(new Date(o.created_at))} · {o.code}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className={`block text-sm font-bold ${resultCents < 0 ? "text-coral-deep" : "text-botanical-deep"}`}>
                      {resultCents < 0 ? "−" : "+"}
                      {formatARS(Math.abs(resultCents))}
                    </span>
                    <span className="block text-xs text-muted">
                      acumulado {runningCents < 0 ? "−" : "+"}
                      {formatARS(Math.abs(runningCents))}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <p className="mt-3 text-xs text-muted">
            Los montos usan el recargo actual ({pct(percent)}) y lo que Mercado Pago informó que te llegó en cada pago.
          </p>
        </>
      )}
    </div>
  );
}
