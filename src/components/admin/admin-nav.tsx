"use client";

import { BellRing, CalendarClock, CirclePlus, HandCoins, ClipboardList, ExternalLink, LayoutDashboard, LogOut, Menu, Package, RefreshCw, Settings, ShoppingBasket, Tags, TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { signOut } from "@/app/admin/actions";
import { LeafMark } from "@/components/store/logo";

const items = [
  { href: "/admin", label: "Inicio", icon: LayoutDashboard, exact: true },
  { href: "/admin/vender", label: "Venta rápida", icon: CirclePlus },
  { href: "/admin/pedidos", label: "Pedidos", icon: ClipboardList },
  { href: "/admin/deudas", label: "Quién me debe", icon: HandCoins },
  { href: "/admin/ventas", label: "Ventas", icon: TrendingUp },
  { href: "/admin/productos", label: "Productos", icon: Package },
  { href: "/admin/reponer", label: "Qué pedir", icon: ShoppingBasket },
  { href: "/admin/vencimientos", label: "Vencimientos", icon: CalendarClock },
  { href: "/admin/avisos", label: "Avisos de stock", icon: BellRing },
  { href: "/admin/precios", label: "Precios y fotos Natura", icon: RefreshCw },
  { href: "/admin/categorias", label: "Categorías", icon: Tags },
  { href: "/admin/configuracion", label: "Configuración", icon: Settings },
];

function isActive(pathname: string, item: (typeof items)[number]) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

/** Lista vertical de secciones (la misma en la computadora y en el menú del celular). */
function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex h-12 items-center gap-3 rounded-2xl px-3.5 font-semibold whitespace-nowrap transition-colors lg:h-11 lg:gap-2.5 ${active ? "bg-sage text-botanical-deep" : "text-forest/80 hover:bg-forest/5"}`}
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
          onClick={onNavigate}
          className="flex h-12 items-center gap-3 rounded-2xl px-3.5 font-semibold whitespace-nowrap text-forest/80 hover:bg-forest/5 lg:h-11 lg:gap-2.5"
        >
          <ExternalLink className="size-5" aria-hidden="true" />
          Ver tienda
        </Link>
      </li>
    </ul>
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

/** Menú lateral del celular: se abre desde la izquierda con todas las secciones una debajo de la otra. */
function MobileDrawer({ pathname, email, onClose }: { pathname: string; email: string | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100] lg:hidden">
      <button type="button" aria-label="Cerrar menú" onClick={onClose} className="absolute inset-0 bg-forest/40 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Secciones del panel"
        className="absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col overflow-y-auto bg-warm-white shadow-xl"
      >
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <Brand />
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="inline-flex size-10 items-center justify-center rounded-full hover:bg-forest/5"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Panel" className="px-3 pb-4">
          <NavList pathname={pathname} onNavigate={onClose} />
        </nav>
        <div className="mt-auto border-t border-line p-4">
          <SignOut email={email} />
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function AdminNav({ email }: { email: string | null }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const current = items.find((item) => isActive(pathname, item));

  return (
    <>
      {/* Celular: barra de arriba con el botón Menú. */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-warm-white px-4 py-2.5 lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-forest bg-white px-4 font-bold"
        >
          <Menu className="size-5" aria-hidden="true" />
          {current?.label ?? "Menú"}
        </button>
      </header>
      {open ? <MobileDrawer pathname={pathname} email={email} onClose={close} /> : null}

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
