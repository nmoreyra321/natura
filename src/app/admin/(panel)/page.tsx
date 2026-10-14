import { AlertTriangle, BellRing, CalendarClock, ClipboardList, Eye, FileEdit, HandCoins, PackageX, Percent, Plus, Settings, Tags, TrendingDown } from "lucide-react";
import Link from "next/link";

import { LinkButton } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { LOW_STOCK_THRESHOLD } from "@/lib/config";
import { groupDebts } from "@/lib/debts";
import { formatARS } from "@/lib/format";
import { expiryWarningLimit } from "@/lib/lots";
import { getWhatsAppNumber } from "@/lib/whatsapp";

export const metadata = { title: "Inicio" };

export default async function DashboardPage() {
  const { supabase } = await requireAdmin();
  const [{ data: products, error }, { count: pendingOrders }, { count: expiringLots }, { data: unpaid }, { data: restock }] =
    await Promise.all([
      supabase.from("products").select("id, name, status, stock, is_offer, discount_percent"),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("product_lots").select("id", { count: "exact", head: true }).lte("expires_on", expiryWarningLimit()),
      supabase
        .from("orders")
        .select(
          "id, code, customer_name, customer_phone, total, amount_paid, created_at, payment_note, payment_method, payment_status, status",
        )
        .neq("status", "cancelled")
        .neq("payment_method", "mercadopago")
        .or("payment_status.is.null,payment_status.neq.approved")
        .limit(1000),
      supabase.from("restock_requests").select("id, product:products(stock)").is("notified_at", null).limit(1000),
    ]);
  const debts = groupDebts(unpaid ?? []);
  const owedTotal = debts.reduce((sum, d) => sum + d.owedCents, 0);
  const restockWaiting = restock?.length ?? 0;
  const restockReady = (restock ?? []).filter((r) => (r.product?.stock ?? 0) > 0).length;

  const list = products ?? [];
  const published = list.filter((p) => p.status === "published");
  // Publicados que se están por acabar: los más urgentes primero.
  const toRestock = published
    .filter((p) => p.stock <= LOW_STOCK_THRESHOLD)
    .sort((a, b) => a.stock - b.stock || a.name.localeCompare(b.name, "es"))
    .slice(0, 6);
  const stats = [
    { label: "Publicados", value: list.filter((p) => p.status === "published").length, icon: Eye, href: "/admin/productos?estado=published", tone: "bg-sage text-botanical-deep" },
    { label: "Borradores", value: list.filter((p) => p.status === "draft").length, icon: FileEdit, href: "/admin/productos?estado=draft", tone: "bg-cream text-forest" },
    { label: "Publicados sin stock", value: published.filter((p) => p.stock === 0).length, icon: PackageX, href: "/admin/productos?estado=published&stock=sin", tone: "bg-coral-soft text-coral-deep" },
    { label: `Stock bajo (≤ ${LOW_STOCK_THRESHOLD})`, value: published.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length, icon: TrendingDown, href: "/admin/productos?estado=published&stock=bajo", tone: "bg-blush text-coral-deep" },
    { label: "En oferta", value: list.filter((p) => p.is_offer && Number(p.discount_percent) > 0).length, icon: Percent, href: "/admin/productos?oferta=1", tone: "bg-pink text-forest" },
  ];
  const whatsapp = getWhatsAppNumber();

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">¡Hola, Mariel!</h1>
          <p className="text-muted">Así está tu tienda hoy.</p>
        </div>
        <LinkButton href="/admin/productos/nuevo" size="lg">
          <Plus className="size-5" aria-hidden="true" /> Nuevo producto
        </LinkButton>
      </div>

      {pendingOrders ? (
        <Link
          href="/admin/pedidos?estado=pending"
          className="mt-6 flex items-center gap-3 rounded-3xl border-2 border-forest bg-sun p-4 font-semibold shadow-[3px_3px_0_var(--forest)] hover:bg-sun/80"
        >
          <ClipboardList className="size-6 shrink-0" aria-hidden="true" />
          Tenés {pendingOrders} {pendingOrders === 1 ? "pedido pendiente" : "pedidos pendientes"} de confirmar. Ver pedidos →
        </Link>
      ) : null}

      {expiringLots ? (
        <Link
          href="/admin/vencimientos"
          className="mt-3 flex items-center gap-3 rounded-3xl border-2 border-forest bg-coral-soft p-4 font-semibold shadow-[3px_3px_0_var(--forest)] hover:bg-blush"
        >
          <CalendarClock className="size-6 shrink-0 text-coral-deep" aria-hidden="true" />
          {expiringLots} {expiringLots === 1 ? "lote vence" : "lotes vencen"} en los próximos 3 meses (o ya {expiringLots === 1 ? "venció" : "vencieron"}). Ver la lista →
        </Link>
      ) : null}

      {owedTotal > 0 ? (
        <Link
          href="/admin/deudas"
          className="mt-3 flex items-center gap-3 rounded-3xl border-2 border-forest bg-lilac p-4 font-semibold shadow-[3px_3px_0_var(--forest)] hover:bg-lilac/80"
        >
          <HandCoins className="size-6 shrink-0 text-grape" aria-hidden="true" />
          Tenés {formatARS(owedTotal)} por cobrar ({debts.length} {debts.length === 1 ? "clienta" : "clientas"}). Ver quién te
          debe →
        </Link>
      ) : null}

      {restockWaiting > 0 ? (
        <Link
          href="/admin/avisos"
          className={`mt-3 flex items-center gap-3 rounded-3xl border-2 border-forest p-4 font-semibold shadow-[3px_3px_0_var(--forest)] ${restockReady > 0 ? "bg-sage hover:bg-sage/80" : "bg-warm-white hover:bg-cream"}`}
        >
          <BellRing className="size-6 shrink-0 text-botanical-deep" aria-hidden="true" />
          {restockReady > 0
            ? `¡${restockReady} ${restockReady === 1 ? "clienta espera" : "clientas esperan"} productos que ya tienen stock! Avisales →`
            : `${restockWaiting} ${restockWaiting === 1 ? "clienta espera" : "clientas esperan"} que vuelvan productos. Ver avisos →`}
        </Link>
      ) : null}

      {!whatsapp ? (
        <div className="mt-6 flex gap-3 rounded-3xl border border-coral/40 bg-coral-soft p-4" role="status">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-coral-deep" aria-hidden="true" />
          <div>
            <p className="font-semibold">Falta configurar el número de WhatsApp.</p>
            <p className="text-sm">
              Mientras tanto, los clientes pueden armar el carrito pero no enviar pedidos.{" "}
              <Link href="/admin/configuracion" className="font-semibold underline">Ver cómo configurarlo</Link>
            </p>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-6 rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar las estadísticas.</p>
      ) : null}

      <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <li key={s.label}>
            <Link href={s.href} className="flex h-full flex-col gap-3 rounded-3xl bg-warm-white p-4 shadow-soft transition-shadow hover:shadow-lift">
              <span className={`flex size-10 items-center justify-center rounded-full ${s.tone}`}>
                <s.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="text-3xl font-extrabold tabular">{s.value}</span>
              <span className="text-sm font-semibold text-muted">{s.label}</span>
            </Link>
          </li>
        ))}
      </ul>

      {toRestock.length > 0 ? (
        <section className="mt-6 rounded-3xl bg-warm-white p-4 shadow-soft" aria-labelledby="reponer">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="reponer" className="font-display text-lg font-bold">Para reponer</h2>
            <Link href="/admin/productos?vista=stock" className="text-sm font-semibold text-coral-deep hover:underline">
              Cargar stock →
            </Link>
          </div>
          <ul className="mt-2 divide-y divide-line/70">
            {toRestock.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <Link href={`/admin/productos/${p.id}`} className="min-w-0 truncate hover:text-coral-deep">
                  {p.name}
                </Link>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold tabular ${p.stock === 0 ? "bg-coral-soft text-coral-deep" : "bg-sun text-forest"}`}
                >
                  {p.stock === 0 ? "Sin stock" : `Quedan ${p.stock}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {list.length === 0 && !error ? (
        <div className="mt-8 rounded-3xl border border-dashed border-line bg-warm-white p-8 text-center">
          <p className="font-display text-xl font-bold">Todavía no cargaste productos.</p>
          <p className="mt-1 text-muted">Creá el primero: cuando lo publiques, va a aparecer en la tienda.</p>
          <LinkButton href="/admin/productos/nuevo" className="mt-5">
            <Plus className="size-5" aria-hidden="true" /> Cargar mi primer producto
          </LinkButton>
        </div>
      ) : null}

      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <Link href="/admin/categorias" className="flex items-center gap-3 rounded-3xl bg-warm-white p-5 shadow-soft hover:shadow-lift">
          <Tags className="size-6 text-botanical" aria-hidden="true" />
          <span>
            <span className="block font-semibold">Categorías</span>
            <span className="text-sm text-muted">Ordená y editá las secciones de la tienda</span>
          </span>
        </Link>
        <Link href="/admin/configuracion" className="flex items-center gap-3 rounded-3xl bg-warm-white p-5 shadow-soft hover:shadow-lift">
          <Settings className="size-6 text-botanical" aria-hidden="true" />
          <span>
            <span className="block font-semibold">Configuración</span>
            <span className="text-sm text-muted">WhatsApp y estado de la tienda</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
