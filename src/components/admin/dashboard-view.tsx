import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  PackagePlus,
  CirclePlus,
  ExternalLink,
  PackageCheck,
  Plus,
  Receipt,
  ShoppingBag,
  Sparkles,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";

import { ProductImageFallback } from "@/components/store/product-card";
import { formatARS } from "@/lib/format";
import { SalesChart, type SalesBar } from "./sales-chart";

export type DashboardTask = { href: string; icon: LucideIcon; text: string; tone: "urgent" | "money" | "good" | "info" };
export type DashboardTop = { id: string | null; name: string; units: number; cents: number; image: string | null };
export type DashboardStat = { label: string; value: number; href: string; alert?: boolean };

export type DashboardData = {
  dateLabel: string;
  monthLabel: string;
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

const TASK_TONES: Record<DashboardTask["tone"], string> = {
  urgent: "bg-sun text-forest",
  money: "bg-lilac text-grape",
  good: "bg-sage text-botanical-deep",
  info: "bg-coral-soft text-coral-deep",
};

function QuickAction({ href, icon: Icon, label, external }: { href: string; icon: LucideIcon; label: string; external?: boolean }) {
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      className="flex items-center gap-2.5 rounded-2xl bg-white/12 px-3.5 py-3 text-sm font-bold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/22"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-forest">
        <Icon className="size-4.5" aria-hidden="true" />
      </span>
      {label}
    </Link>
  );
}

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
      {/* Portada */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-forest via-grape to-coral-deep p-5 text-white shadow-lift sm:p-7">
        <span className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-coral/40 blur-3xl" aria-hidden="true" />
        <span className="pointer-events-none absolute -bottom-20 left-1/3 size-64 rounded-full bg-sun/25 blur-3xl" aria-hidden="true" />
        <div className="relative grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold">
              <Sparkles className="size-3.5" aria-hidden="true" /> {d.dateLabel.charAt(0).toUpperCase() + d.dateLabel.slice(1)}
            </p>
            <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">¡Hola, Mariel!</h1>
            <p className="mt-4 text-sm font-semibold text-white/80">Vendiste en {d.monthLabel.toLowerCase()}</p>
            <p className="font-display text-4xl font-bold tabular sm:text-5xl">{formatARS(d.month.cents)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              {d.month.change !== null ? (
                <span
                  className={`inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 font-bold ${up ? "bg-sage text-botanical-deep" : "bg-white text-coral-deep"}`}
                >
                  {up ? <ArrowUpRight className="size-4" aria-hidden="true" /> : <ArrowDownRight className="size-4" aria-hidden="true" />}
                  {up ? "+" : ""}
                  {d.month.change}% vs. {d.prevMonthLabel}
                </span>
              ) : null}
              <span className="text-white/85">
                Hoy: <strong className="text-white">{formatARS(d.today.cents)}</strong> en {d.today.orders}{" "}
                {d.today.orders === 1 ? "venta" : "ventas"}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction href="/admin/vender" icon={CirclePlus} label="Venta rápida" />
            <QuickAction href="/admin/productos?vista=llego" icon={PackagePlus} label="Me llegó mercadería" />
            <QuickAction href="/admin/productos/nuevo" icon={Plus} label="Nuevo producto" />
            <QuickAction href="/" icon={ExternalLink} label="Ver tienda" external />
          </div>
        </div>
      </section>

      {d.warnings}

      {/* Para hacer */}
      <section aria-labelledby="hacer">
        <h2 id="hacer" className="mb-2 font-display text-lg font-bold">
          Para hacer hoy
        </h2>
        {d.tasks.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {d.tasks.map((t) => (
              <li key={t.href + t.text}>
                <Link
                  href={t.href}
                  className="group flex h-full items-center gap-3 rounded-2xl bg-warm-white p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${TASK_TONES[t.tone]}`}>
                    <t.icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-snug font-semibold">{t.text}</span>
                  <ArrowRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-coral-deep" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-3 rounded-2xl bg-sage p-4 font-semibold text-botanical-deep">
            <PackageCheck className="size-6 shrink-0" aria-hidden="true" /> ¡Todo al día! No hay nada pendiente.
          </p>
        )}
      </section>

      {/* Números del mes */}
      <section aria-label="Números del mes" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={ShoppingBag} label="Ventas del mes" value={String(d.month.orders)} hint={`${d.month.units} unidades`} tone="bg-sage text-botanical-deep" />
        <Kpi icon={Receipt} label="Ticket promedio" value={formatARS(d.month.averageCents)} hint="por venta" tone="bg-coral-soft text-coral-deep" />
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
              Qué pedir →
            </Link>
            <Link href="/admin/productos?vista=llego" className="text-coral-deep hover:underline">
              Me llegó mercadería →
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
  );
}
