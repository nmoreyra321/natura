import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  PackagePlus,
  CirclePlus,
  ExternalLink,
  Plus,
  Receipt,
  ShoppingBag,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { ProductImageFallback } from "@/components/store/product-card";
import { formatARS } from "@/lib/format";
import { AllDone } from "./all-done";
import { CountUp } from "./count-up";
import { MonthGoal } from "./month-goal";
import { SalesChart, type SalesBar } from "./sales-chart";

export type DashboardTask = { href: string; icon: LucideIcon; text: string; tone: "urgent" | "money" | "good" | "info" };
export type DashboardTop = { id: string | null; name: string; units: number; cents: number; image: string | null };
export type DashboardStat = { label: string; value: number; href: string; alert?: boolean };

export type DashboardData = {
  dateLabel: string;
  monthLabel: string;
  /** «2026-10»: para festejar la meta una sola vez por mes. */
  monthKey: string;
  /** Meta de ventas del mes en pesos (0 = sin meta). */
  goalPesos: number;
  prevMonthLabel: string;
  month: { cents: number; orders: number; units: number; averageCents: number; change: number | null };
  today: { cents: number; orders: number };
  bars: SalesBar[];
  last14Cents: number;
  owed: { cents: number; people: number };
  tasks: DashboardTask[];
  top: DashboardTop[];
  stats: DashboardStat[];
  warnings: React.ReactNode;
};


function Kpi({ icon: Icon, label, value, hint, tone }: { icon: LucideIcon; label: string; value: string; hint?: string; tone: string }) {
  return (
    <div className="rounded-3xl bg-warm-white p-4 shadow-soft">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted">
        <span className={`flex size-8 items-center justify-center rounded-xl ${tone}`}>
          <Icon className="size-4.5" aria-hidden="true" />
        </span>
        {label}
      </div>
      <p className="mt-2 font-display text-2xl font-bold tabular sm:text-3xl">{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Inicio del panel: resumen del mes, lo que hay que hacer hoy, ventas recientes y catálogo. */
export function DashboardView({ d, imageUrl }: { d: DashboardData; imageUrl: (path: string) => string | null }) {
  const up = (d.month.change ?? 0) >= 0;
  const maxTop = Math.max(...d.top.map((t) => t.units), 1);

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      {/* Saludo */}
      <section>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">Hola, Mariel 👋</h1>
        <p className="mt-1 text-lg">
          Este mes vendiste <strong><CountUp cents={d.month.cents} /></strong>
          {d.month.change !== null ? (
            <span className={`ml-2 inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-sm font-bold ${up ? "bg-sage text-botanical-deep" : "bg-coral-soft text-coral-deep"}`}>
              {up ? <ArrowUpRight className="size-4" aria-hidden="true" /> : <ArrowDownRight className="size-4" aria-hidden="true" />}
              {up ? "+" : ""}
              {d.month.change}% vs. {d.prevMonthLabel}
            </span>
          ) : null}
        </p>
      </section>

      {d.warnings}

      <MonthGoal monthKey={d.monthKey} soldCents={d.month.cents} goalPesos={d.goalPesos} />

      {/* Para hacer */}
      <section aria-labelledby="hacer">
        <h2 id="hacer" className="mb-3 font-display text-2xl font-bold">
          {d.tasks.length > 0 ? `Para hacer hoy (${d.tasks.length})` : "Para hacer hoy"}
        </h2>
        {d.tasks.length > 0 ? (
          <ol className="flex flex-col gap-3">
            {d.tasks.map((t, n) => (
              <li key={t.href + t.text}>
                <Link href={t.href} className="group flex items-center gap-4 rounded-2xl bg-warm-white p-4 shadow-soft">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-coral-deep font-extrabold text-white">{n + 1}</span>
                  <span className="min-w-0 flex-1 text-lg leading-snug font-extrabold">{t.text}</span>
                  <ArrowRight className="size-5 shrink-0 text-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ol>
        ) : (
          <AllDone />
        )}
      </section>

      {/* Lo que se hace seguido */}
      <section aria-labelledby="seguido">
        <h2 id="seguido" className="mb-3 font-display text-2xl font-bold">
          Cosas que hacés seguido
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/admin/vender" className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-warm-white p-3 text-center text-lg font-extrabold shadow-soft">
            <CirclePlus className="size-7 text-coral-deep" aria-hidden="true" /> Anotar una venta
          </Link>
          <Link href="/admin/productos?vista=llego" className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-warm-white p-3 text-center text-lg font-extrabold shadow-soft">
            <PackagePlus className="size-7 text-coral-deep" aria-hidden="true" /> Cargar una caja de Natura
          </Link>
          <Link href="/admin/productos/nuevo" className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-warm-white p-3 text-center font-bold shadow-soft">
            <Plus className="size-5" aria-hidden="true" /> Nuevo producto
          </Link>
          <Link href="/" target="_blank" className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-warm-white p-3 text-center font-bold shadow-soft">
            <ExternalLink className="size-5" aria-hidden="true" /> Ver la tienda
          </Link>
        </div>
      </section>

      <details className="group rounded-3xl bg-warm-white p-4 shadow-soft">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between text-lg font-extrabold">
          Ver los números del mes y el catálogo <span aria-hidden="true" className="text-2xl text-muted group-open:rotate-90">›</span>
        </summary>
        <div className="mt-4 flex flex-col gap-5">
      {/* Números del mes */}
      <section aria-label="Números del mes" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={ShoppingBag} label="Ventas del mes" value={String(d.month.orders)} hint={`${d.month.units} unidades`} tone="bg-sage text-botanical-deep" />
        <Kpi icon={Receipt} label="Venta promedio" value={formatARS(d.month.averageCents)} hint="por venta" tone="bg-coral-soft text-coral-deep" />
        <Kpi icon={Wallet} label="Por cobrar" value={formatARS(d.owed.cents)} hint={d.owed.people ? `${d.owed.people} ${d.owed.people === 1 ? "clienta" : "clientas"}` : "nadie te debe"} tone="bg-lilac text-grape" />
        <Kpi icon={Trophy} label="Últimos 14 días" value={formatARS(d.last14Cents)} hint="vendido" tone="bg-sun text-forest" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        {/* Ventas recientes */}
        <section className="rounded-3xl bg-warm-white p-4 shadow-soft sm:p-5" aria-labelledby="ultimos">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id="ultimos" className="font-display text-lg font-bold">
              Ventas de los últimos 14 días
            </h2>
            <Link href="/admin/ventas" className="text-sm font-semibold text-coral-deep hover:underline">
              Ver ventas →
            </Link>
          </div>
          <SalesChart bars={d.bars} title="Ventas de los últimos 14 días" tickEvery={2} />
        </section>

        {/* Más vendidos */}
        <section className="rounded-3xl bg-warm-white p-4 shadow-soft sm:p-5" aria-labelledby="top">
          <h2 id="top" className="font-display text-lg font-bold">
            Lo más vendido del mes
          </h2>
          {d.top.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Todavía no hay ventas este mes. ¡Las primeras van a aparecer acá!</p>
          ) : (
            <ol className="mt-3 flex flex-col gap-2.5">
              {d.top.map((t, i) => {
                const src = t.image ? imageUrl(t.image) : null;
                const body = (
                  <>
                    <span className="w-4 shrink-0 text-center font-display font-bold text-muted">{i + 1}</span>
                    <span className="relative size-10 shrink-0 overflow-hidden rounded-xl bg-white">
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="" className="size-full object-cover" loading="lazy" />
                      ) : (
                        <ProductImageFallback className="size-full" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-1 text-sm font-semibold">{t.name}</span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-cream">
                        <span className="block h-full rounded-full bg-coral-deep" style={{ width: `${(t.units / maxTop) * 100}%` }} />
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted tabular">
                      <strong className="block text-sm text-forest">{t.units} u.</strong>
                      {formatARS(t.cents)}
                    </span>
                  </>
                );
                return (
                  <li key={t.id ?? t.name}>
                    {t.id ? (
                      <Link href={`/admin/productos/${t.id}`} className="flex items-center gap-2.5 rounded-xl hover:bg-cream/70">
                        {body}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      {/* Catálogo */}
      <section className="rounded-3xl bg-warm-white p-4 shadow-soft sm:p-5" aria-labelledby="catalogo">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="catalogo" className="font-display text-lg font-bold">
            Tu catálogo
          </h2>
          <span className="flex gap-4 text-sm font-semibold">
            <Link href="/admin/reponer" className="text-coral-deep hover:underline">
              Qué pedirle a Natura →
            </Link>
            <Link href="/admin/productos?vista=llego" className="text-coral-deep hover:underline">
              Cargar caja de Natura →
            </Link>
          </span>
        </div>
        <ul className="mt-3 flex flex-wrap gap-2">
          {d.stats.map((s) => (
            <li key={s.label}>
              <Link
                href={s.href}
                className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition hover:shadow-soft ${s.alert && s.value > 0 ? "bg-coral-soft text-coral-deep ring-coral-deep/20" : "bg-cream text-forest ring-line"}`}
              >
                <strong className="font-display text-base tabular">{s.value}</strong> {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>
        </div>
      </details>
    </div>
  );
}
