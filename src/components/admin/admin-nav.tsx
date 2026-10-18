"use client";

import { Home, Wallet, BellRing, CalendarClock, CalendarHeart, CirclePlus, Gift, HandCoins, ClipboardList, ExternalLink, LayoutDashboard, LogOut, Menu, MessageSquareHeart, Package, Settings, ShoppingBasket, TrendingUp, Percent } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/admin/actions";
import { LeafMark } from "@/components/store/logo";

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean; also?: string[] };

/** Secciones del menú, agrupadas para que sea más fácil encontrar todo. */
const groups: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ href: "/admin", label: "Inicio", icon: LayoutDashboard, exact: true }] },
  {
    title: "Vender",
    items: [
      { href: "/admin/vender", label: "Venta rápida", icon: CirclePlus },
      { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
      { href: "/admin/deudas", label: "Quién me debe", icon: HandCoins },
      { href: "/admin/ventas", label: "Ventas y estadísticas", icon: TrendingUp },
      { href: "/admin/comision", label: "Comisión de Mercado Pago", icon: Percent },
      { href: "/admin/club", label: "Club de clientas", icon: Gift },
      { href: "/admin/fechas", label: "Fechas especiales", icon: CalendarHeart },
      { href: "/admin/resenas", label: "Reseñas", icon: MessageSquareHeart },
    ],
  },
  {
    title: "Mercadería",
    items: [
      { href: "/admin/productos", label: "Productos", icon: Package, also: ["/admin/categorias", "/admin/precios"] },
      { href: "/admin/reponer", label: "Qué pedirle a Natura", icon: ShoppingBasket },
      { href: "/admin/vencimientos", label: "Próximos a vencer", icon: CalendarClock },
      { href: "/admin/avisos", label: "Lista de espera de stock", icon: BellRing },
    ],
  },
  { title: "Ajustes", items: [{ href: "/admin/configuracion", label: "Configuración", icon: Settings }] },
];
const items = groups.flatMap((g) => g.items);

/** Barra de abajo en el celular: cinco lugares fijos. */
const TABS: (NavItem & { badge?: "pedidos" })[] = [
  { href: "/admin", label: "Hoy", icon: Home, exact: true, also: ["/admin/vender"] },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList, badge: "pedidos" },
  { href: "/admin/productos", label: "Productos", icon: Package, also: ["/admin/categorias", "/admin/precios", "/admin/inventario"] },
  { href: "/admin/deudas", label: "Plata", icon: Wallet, also: ["/admin/ventas", "/admin/comision"] },
  {
    href: "/admin/mas",
    label: "Más",
    icon: Menu,
    also: ["/admin/club", "/admin/fechas", "/admin/resenas", "/admin/reponer", "/admin/vencimientos", "/admin/avisos", "/admin/configuracion"],
  },
];

function isActive(pathname: string, item: NavItem) {
  if (item.exact) return pathname === item.href || (item.also ?? []).some((h) => pathname.startsWith(h));
  return [item.href, ...(item.also ?? [])].some((h) => pathname.startsWith(h));
}

/** Lista vertical de secciones (la misma en la computadora y en el menú del celular). */
function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const link = (active: boolean) =>
    `flex h-10 items-center gap-2.5 rounded-xl px-3 text-[15px] font-semibold whitespace-nowrap transition-colors ${active ? "bg-sage text-botanical-deep" : "text-forest/80 hover:bg-forest/5"}`;
  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <div key={g.title ?? "inicio"}>
          {g.title ? <p className="px-3 pb-1 text-[11px] font-bold tracking-wider text-muted uppercase">{g.title}</p> : null}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((item) => {
              const active = isActive(pathname, item);
              return (
                <li key={item.href}>
                  <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={link(active)}>
                    <item.icon className="size-[18px]" aria-hidden="true" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            {g.title === "Ajustes" ? (
              <li>
                <Link href="/" target="_blank" onClick={onNavigate} className={link(false)}>
                  <ExternalLink className="size-[18px]" aria-hidden="true" />
                  Ver tienda
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      ))}
    </div>
  );
}

function SignOut({ email }: { email: string | null }) {
  return (
    <>
      {email ? (
        <p className="truncate text-sm text-muted" title={email}>
          {email}
        </p>
      ) : null}
      <form action={signOut} className="mt-2">
        <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-full px-3 font-semibold hover:bg-forest/5">
          <LogOut className="size-4" aria-hidden="true" /> Cerrar sesión
        </button>
      </form>
    </>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-2 font-display text-xl font-bold">
      <LeafMark className="size-7 text-botanical" />
      <span>
        Natu <span className="text-coral-deep">Mariel</span>
      </span>
    </Link>
  );
}

export function AdminNav({ email, pedidosCount = 0 }: { email: string | null; pedidosCount?: number }) {
  const pathname = usePathname();
  const current = items.find((item) => isActive(pathname, item));

  return (
    <>
      {/* Celular: barra de arriba con el nombre y barra de abajo con cinco lugares. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-warm-white px-4 py-2.5 lg:hidden">
        <Brand />
        <span className="text-lg font-bold">{current?.label ?? ""}</span>
      </header>
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-warm-white px-1 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-4px_14px_rgba(60,20,80,0.08)] lg:hidden"
      >
        {TABS.map((t) => {
          const active = isActive(pathname, t);
          const count = t.badge === "pedidos" ? pedidosCount : 0;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[13px] font-extrabold ${active ? "text-coral-deep" : "text-muted"}`}
            >
              {active ? <span aria-hidden="true" className="absolute -top-1.5 h-1 w-9 rounded-full bg-coral-deep" /> : null}
              <t.icon className="size-6" aria-hidden="true" />
              {t.label}
              {count > 0 ? (
                <span className="absolute top-0.5 left-1/2 ml-2 inline-flex min-w-5 items-center justify-center rounded-full bg-coral-deep px-1.5 text-xs font-bold text-white">
                  {count}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* Computadora: barra lateral fija. */}
      <aside className="sticky top-0 z-30 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-warm-white lg:flex">
        <div className="p-5">
          <Brand />
        </div>
        <nav aria-label="Panel" className="min-h-0 flex-1 overflow-y-auto px-3">
          <NavList pathname={pathname} />
        </nav>
        <div className="p-5">
          <SignOut email={email} />
        </div>
      </aside>
    </>
  );
}
