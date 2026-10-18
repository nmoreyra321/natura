"use client";

import { Gift, House, LayoutGrid, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cartCount, cartDrawer, useCart, useCartHydrated } from "@/lib/cart-store";

const TABS = [
  { href: "/", label: "Inicio", Icon: House },
  { href: "/productos", label: "Productos", Icon: LayoutGrid },
  { href: "/club", label: "Club", Icon: Gift },
] as const;

/**
 * Barra de abajo en el celular, como en una app: Inicio, Productos, Club y Carrito.
 * No aparece en el carrito ni en el pedido (ahí ya hay botones fijos propios).
 */
export function BottomNav() {
  const pathname = usePathname();
  const items = useCart();
  const hydrated = useCartHydrated();
  const count = hydrated ? cartCount(items) : 0;
  if (pathname === "/carrito" || pathname.startsWith("/pedido/")) return null;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const base = "relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[0.68rem] font-extrabold transition-colors";

  return (
    <>
      <div aria-hidden="true" className="h-24 md:hidden" />
      <nav
        aria-label="Menú principal"
        className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 flex items-center rounded-[1.75rem] bg-white/92 p-1.5 shadow-lift ring-1 ring-line/70 backdrop-blur-md md:hidden"
      >
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} prefetch aria-current={active ? "page" : undefined} className={`${base} ${active ? "text-coral-deep" : "text-muted"}`}>
              {active ? <span aria-hidden="true" className="animate-nav-dot absolute -top-1.5 h-1 w-6 rounded-full bg-coral-deep" /> : null}
              <Icon className="size-5.5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
        <button type="button" data-cart-target onClick={() => cartDrawer.open()} aria-haspopup="dialog" aria-label={count > 0 ? `Carrito: ${count} ${count === 1 ? "producto" : "productos"}` : "Carrito vacío"} className={`${base} text-muted`}>
          <span className="relative">
            <ShoppingBag className="size-5.5" aria-hidden="true" />
            {count > 0 ? (
              <span key={count} className="animate-pop absolute -top-1.5 -right-2.5 flex min-w-4 items-center justify-center rounded-full bg-coral-deep px-1 text-[0.62rem] leading-4 font-bold text-white tabular" aria-hidden="true">
                {count > 99 ? "99+" : count}
              </span>
            ) : null}
          </span>
          Carrito
        </button>
      </nav>
    </>
  );
}
