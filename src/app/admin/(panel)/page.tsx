import { AlertTriangle, BadgeDollarSign, BellRing, CalendarClock, ClipboardList, FileText, HandCoins } from "lucide-react";
import Link from "next/link";

import { PushToggle } from "@/components/admin/push-toggle";
import { DashboardView, type DashboardTask } from "@/components/admin/dashboard-view";
import { requireAdmin } from "@/lib/auth";
import { LOW_STOCK_THRESHOLD } from "@/lib/config";
import { groupDebts } from "@/lib/debts";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { expiryWarningLimit } from "@/lib/lots";
import { toCents } from "@/lib/pricing";
import {
  currentMonth,
  monthLabel,
  monthStartIso,
  percentChange,
  recentDays,
  shiftDay,
  shiftMonth,
  summarizeMonth,
  todayKey,
  type SalesOrder,
} from "@/lib/sales";
import { getWhatsAppNumber } from "@/lib/whatsapp";

export const metadata = { title: "Inicio" };

const longDate = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const dueFmt = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "long", timeZone: "UTC" });
const atNoon = (day: string) => new Date(`${day}T12:00:00Z`);

export default async function DashboardPage() {
  const { supabase } = await requireAdmin();
  const today = todayKey();
  const month = currentMonth();
  const prevMonth = shiftMonth(month, -1);
  // Desde lo que empiece antes: el mes anterior o hace 14 días.
  const since = [monthStartIso(prevMonth), new Date(`${shiftDay(today, -14)}T00:00:00-03:00`).toISOString()].sort()[0];

  const [
    { data: products, error },
    { count: pendingOrders },
    { count: expiringLots },
    { data: unpaid },
    { data: restock },
    { data: orders },
    { data: dueReceipt },
    { count: paymentsToReview },
  ] = await Promise.all([
    supabase.from("products").select("id, name, status, stock, is_offer, discount_percent, images:product_images(storage_path, position)"),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("product_lots").select("id", { count: "exact", head: true }).lte("expires_on", expiryWarningLimit()),
    supabase
      .from("orders")
      .select("id, code, customer_name, customer_phone, total, amount_paid, created_at, payment_note, payment_method, payment_status, status")
      .in("status", ["confirmed", "delivered"])
      .neq("payment_method", "mercadopago")
      .or("payment_status.is.null,payment_status.neq.approved")
      .limit(1000),
    supabase.from("restock_requests").select("id, product:products(stock)").is("notified_at", null).limit(1000),
    supabase
      .from("orders")
      .select("status, total, savings, created_at, items:order_items(product_id, name, quantity, unit_price)")
      .gte("created_at", since)
      .limit(10000),
    supabase
      .from("receipts")
      .select("invoice_number, due_date, total")
      .gte("due_date", today)
      .lte("due_date", shiftDay(today, 10))
      .order("due_date")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("payment_method", "transferencia")
      .not("payment_reported_at", "is", null)
      .neq("status", "cancelled")
      .or("payment_status.is.null,payment_status.neq.approved"),
  ]);

  const list = products ?? [];
  const sales = (orders ?? []) as SalesOrder[];
  const s = summarizeMonth(sales, month);
  const p = summarizeMonth(sales, prevMonth);
  const days = recentDays(sales, today, 14);
  const debts = groupDebts(unpaid ?? []);
  const owedCents = debts.reduce((sum, d) => sum + d.owedCents, 0);
  const restockWaiting = restock?.length ?? 0;
  const restockReady = (restock ?? []).filter((r) => (r.product?.stock ?? 0) > 0).length;
  const published = list.filter((x) => x.status === "published");
  const firstImage = new Map(
    list.map((x) => [x.id, [...(x.images ?? [])].sort((a, b) => a.position - b.position)[0]?.storage_path ?? null]),
  );

  // Lo que hay que hacer hoy, lo más importante primero.
  const tasks: DashboardTask[] = [];
  if (paymentsToReview) {
    tasks.push({
      href: "/admin/pedidos",
      icon: BadgeDollarSign,
      tone: "urgent",
      text: `${paymentsToReview} ${paymentsToReview === 1 ? "pago informado" : "pagos informados"}: comprobar el pago`,
    });
  }
  if (pendingOrders) {
    tasks.push({
      href: "/admin/pedidos",
      icon: ClipboardList,
      tone: "urgent",
      text: `${pendingOrders} ${pendingOrders === 1 ? "pedido nuevo para confirmar" : "pedidos nuevos para confirmar"}`,
    });
  }
  if (restockReady > 0) {
    tasks.push({
      href: "/admin/avisos",
      icon: BellRing,
      tone: "good",
      text: `${restockReady} ${restockReady === 1 ? "clienta espera" : "clientas esperan"} un producto que ya volvió: ¡avisales!`,
    });
  }
  if (dueReceipt?.due_date) {
    const daysLeft = Math.round((atNoon(dueReceipt.due_date).getTime() - atNoon(today).getTime()) / 86_400_000);
    tasks.push({
      href: "/admin/productos?vista=llego",
      icon: FileText,
      tone: "urgent",
      text: `Pagar la factura de Natura${dueReceipt.total ? ` (${formatARS(toCents(dueReceipt.total))})` : ""}: ${
        daysLeft === 0 ? "vence hoy" : daysLeft === 1 ? "vence mañana" : `vence el ${dueFmt.format(atNoon(dueReceipt.due_date))}`
      }`,
    });
  }
  if (owedCents > 0) {
    tasks.push({
      href: "/admin/deudas",
      icon: HandCoins,
      tone: "money",
      text: `Cobrar ${formatARS(owedCents)} (${debts.length} ${debts.length === 1 ? "clienta" : "clientas"})`,
    });
  }
  if (expiringLots) {
    tasks.push({
      href: "/admin/vencimientos",
      icon: CalendarClock,
      tone: "info",
      text: `${expiringLots} ${expiringLots === 1 ? "producto está por vencer" : "productos están por vencer"}: ofrecelos primero`,
    });
  }
  if (restockWaiting > restockReady) {
    const n = restockWaiting - restockReady;
    tasks.push({
      href: "/admin/avisos",
      icon: BellRing,
      tone: "info",
      text: `${n} ${n === 1 ? "clienta espera" : "clientas esperan"} que vuelvan productos`,
    });
  }

  const whatsapp = getWhatsAppNumber();
  const warnings = (
    <>
      {!whatsapp ? (
        <div className="flex gap-3 rounded-3xl border border-coral/40 bg-coral-soft p-4" role="status">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-coral-deep" aria-hidden="true" />
          <div>
            <p className="font-semibold">Falta configurar el número de WhatsApp.</p>
            <p className="text-sm">
              Mientras tanto, las clientas pueden armar el carrito pero no hacer pedidos.{" "}
              <Link href="/admin/configuracion" className="font-semibold underline">
                Ver cómo configurarlo
              </Link>
            </p>
          </div>
        </div>
      ) : null}
      {error ? <p className="rounded-2xl bg-coral-soft p-4 font-semibold">No pudimos cargar los productos.</p> : null}
    </>
  );

  const date = longDate.format(atNoon(today));

  return (
    <>
    <div className="mx-auto mb-5 max-w-6xl empty:hidden">
      <PushToggle compact />
    </div>
    <DashboardView
      imageUrl={productImageUrl}
      d={{
        dateLabel: date,
        monthLabel: monthLabel(month).replace(/ de \d{4}$/, ""),
        prevMonthLabel: monthLabel(prevMonth).replace(/ de \d{4}$/, "").toLowerCase(),
        month: {
          cents: s.totalCents,
          orders: s.orders,
          units: s.units,
          averageCents: s.averageCents,
          change: percentChange(s.totalCents, p.totalCents),
        },
        today: { cents: days.at(-1)?.cents ?? 0, orders: days.at(-1)?.orders ?? 0 },
        bars: days.map((x) => {
          const label = longDate.format(atNoon(x.day));
          return {
            tick: String(Number(x.day.slice(8))),
            label: `${label.charAt(0).toUpperCase()}${label.slice(1)}${x.orders ? ` · ${x.orders} ${x.orders === 1 ? "venta" : "ventas"}` : ""}`,
            cents: x.cents,
            current: x.day === today,
          };
        }),
        last14Cents: days.reduce((sum, x) => sum + x.cents, 0),
        owed: { cents: owedCents, people: debts.length },
        tasks,
        top: s.topProducts.slice(0, 5).map((t) => {
          const id = t.key.startsWith("nombre:") ? null : t.key;
          return { id, name: t.name, units: t.units, cents: t.totalCents, image: id ? (firstImage.get(id) ?? null) : null };
        }),
        stats: [
          { label: "publicados", value: published.length, href: "/admin/productos?estado=published" },
          { label: "borradores", value: list.filter((x) => x.status === "draft").length, href: "/admin/productos?estado=draft" },
          {
            label: "sin stock",
            value: published.filter((x) => x.stock === 0).length,
            href: "/admin/productos?estado=published&stock=sin",
            alert: true,
          },
          {
            label: `con stock bajo (≤ ${LOW_STOCK_THRESHOLD})`,
            value: published.filter((x) => x.stock > 0 && x.stock <= LOW_STOCK_THRESHOLD).length,
            href: "/admin/productos?estado=published&stock=bajo",
            alert: true,
          },
          {
            label: "en oferta",
            value: list.filter((x) => x.is_offer && Number(x.discount_percent) > 0).length,
            href: "/admin/productos?oferta=1",
          },
        ],
        warnings,
      }}
    />
    </>
  );
}
