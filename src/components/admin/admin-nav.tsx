"use client";

import { Boxes, CalendarClock, CirclePlus, ClipboardList, ExternalLink, LayoutDashboard, LogOut, Package, RefreshCw, Settings, Tags, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOut } from "@/app/admin/actions";
import { LeafMark } from "@/components/store/logo";

const items = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard, exact: true },
  { href: "/admin/vender", label: "Venta rápida", icon: CirclePlus },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/ventas", label: "Ventas", icon: TrendingUp },
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/inventario", label: "Inventario", icon: Boxes },
  { href: "/admin/vencimientos", label: "Vencimientos", icon: CalendarClock },
  { href: "/admin/precios", label: "Precios Natura", icon: RefreshCw },
  { href: "/admin/categorias", label: "Categorías", icon: Tags },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

export function AdminNav({ email }: { email: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="sticky top-0 z-30 border-b border-line bg-warm-white lg:h-dvh lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0">
      <div className="flex items-center justify-between gap-2 px-4 py-3 lg:flex-col lg:items-stretch lg:gap-6 lg:p-5">
        <Link href="/admin" className="flex items-center gap-2 font-display text-xl font-bold">
          <LeafMark className="size-7 text-botanical" />
          <span>
            Natu <span className="text-coral-deep">Mariel</span>
          </span>
        </Link>
        <form action={signOut} className="lg:hidden">
          <button type="submit" className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm font-semibold hover:bg-forest/5">
            <LogOut className="size-4" aria-hidden="true" /> Salir
          </button>
        </form>
      </div>
      <nav aria-label="Panel" className="overflow-x-auto px-2 pb-2 lg:px-3">
        <ul className="flex gap-1 lg:flex-col">
          {items.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-11 items-center gap-2.5 rounded-2xl px-3.5 font-semibold whitespace-nowrap transition-colors ${active ? "bg-sage text-botanical-deep" : "text-forest/80 hover:bg-forest/5"}`}
                >
                  <item.icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <Link
              href="/"
              target="_blank"
              className="flex h-11 items-center gap-2.5 rounded-2xl px-3.5 font-semibold whitespace-nowrap text-forest/80 hover:bg-forest/5"
            >
              <ExternalLink className="size-5" aria-hidden="true" />
              Ver tienda
            </Link>
          </li>
        </ul>
      </nav>
      <div className="mt-auto hidden p-5 lg:absolute lg:bottom-0 lg:block lg:w-64">
        {email ? <p className="truncate text-sm text-muted" title={email}>{email}</p> : null}
        <form action={signOut} className="mt-2">
          <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-full px-3 font-semibold hover:bg-forest/5">
            <LogOut className="size-4" aria-hidden="true" /> Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
