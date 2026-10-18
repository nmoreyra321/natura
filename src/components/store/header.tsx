"use client";

import { ChevronRight, Heart, LayoutGrid, Menu, MessageCircle, Package, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cartCount, cartDrawer, useCart, useCartHydrated } from "@/lib/cart-store";
import { hideOrderReminder, useRecentOrder, useSavedOrders } from "@/lib/my-orders";
import { AccountMenu } from "./account-menu";
import { CartDrawer } from "./cart-drawer";
import { Logo } from "./logo";
import { InstallAppButton } from "./install-app";
import { SearchBox } from "./search-box";

type NavCategory = { name: string; slug: string };

function CartLink() {
  const items = useCart();
  const hydrated = useCartHydrated();
  const pathname = usePathname();
  const count = cartCount(items);

  // Cada vez que se agrega algo, el carrito se sacude y sale un «+1». No al cargar la página
  // (ahí el carrito «aparece» con lo guardado, no es que se haya agregado algo).
  const [seen, setSeen] = useState({ count, hydrated });
  const [bump, setBump] = useState(0);
  const [added, setAdded] = useState(0);
  if (seen.count !== count || seen.hydrated !== hydrated) {
    if (seen.hydrated && hydrated && count > seen.count) {
      setBump((b) => b + 1);
      setAdded(count - seen.count);
    }
    setSeen({ count, hydrated });
  }

  const label = count > 0 ? `Carrito: ${count} ${count === 1 ? "producto" : "productos"}` : "Carrito vacío";
  const badge =
    count > 0 ? (
      <span
        key={`n${bump}`}
        className={`absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-coral-deep px-1.5 text-[0.7rem] leading-5 font-bold text-white tabular ring-2 ring-cream ${bump ? "animate-pop" : ""}`}
        aria-hidden="true"
      >
        {count > 99 ? "99+" : count}
      </span>
    ) : null;
  const plusOne = bump ? (
    <span
      key={`p${bump}`}
      className="animate-plus-one pointer-events-none absolute -top-4 left-0 rounded-full bg-sun px-1.5 text-xs font-extrabold text-forest shadow-soft"
      aria-hidden="true"
    >
      +{added}
    </span>
  ) : null;
  const icon = <ShoppingBag key={`i${bump}`} className={`size-6 ${bump ? "animate-cart-bump" : ""}`} aria-hidden="true" />;
  const classes =
    "relative inline-flex size-11 items-center justify-center rounded-full text-forest transition-colors hover:bg-forest/5";
  // En la página del carrito el ícono no abre el panel: ya está todo a la vista.
  if (pathname === "/carrito") {
    return (
      <Link href="/carrito" data-cart-target className={classes} aria-label={label}>
        {icon}
        {badge}
        {plusOne}
      </Link>
    );
  }
  return (
    <button type="button" data-cart-target className={classes} aria-label={label} aria-haspopup="dialog" onClick={() => cartDrawer.open()}>
      {icon}
      {badge}
      {plusOne}
    </button>
  );
}

/** Ícono "Mis pedidos", con un puntito si hay pedidos hechos desde este celular. */
function OrdersLink() {
  const saved = useSavedOrders();
  return (
    <Link
      href="/mi-pedido"
      // En el celular no entra: «Seguir mi pedido» está en el menú y en «Mi cuenta».
      className="relative hidden size-11 sm:inline-flex items-center justify-center rounded-full text-forest transition-colors hover:bg-forest/5"
      aria-label={saved.length > 0 ? "Mis pedidos (tenés pedidos hechos)" : "Seguir mi pedido"}
      title="Mis pedidos"
    >
      <Package className="size-5.5" aria-hidden="true" />
      {saved.length > 0 ? (
        <span className="absolute top-2 right-2 size-2.5 rounded-full bg-botanical-deep ring-2 ring-cream" aria-hidden="true" />
      ) : null}
    </Link>
  );
}

/** Franja bajo el menú: "Tenés un pedido en curso" para volver a su página desde cualquier lado. */
function OrderReminder() {
  const order = useRecentOrder();
  const pathname = usePathname();
  if (!order || pathname.startsWith("/pedido/") || pathname === "/mi-pedido") return null;
  return (
    <div className="border-t border-line/70 bg-sage/60">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-1.5 sm:px-6">
        <Link
          href={`/pedido/${order.id}`}
          className="flex min-h-9 flex-1 items-center gap-2 text-sm font-semibold text-forest hover:underline"
        >
          <Package className="size-4 shrink-0 text-botanical-deep" aria-hidden="true" />
          <span>
            Tu pedido <strong>{order.code}</strong>: <span className="text-botanical-deep">ver cómo va</span>
          </span>
          <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={() => hideOrderReminder(order.id)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-white/70"
          aria-label="Ocultar aviso del pedido"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/**
 * ¿Este enlace del menú es la página donde está la clienta? «Ofertas» y «Todos los productos»
 * comparten dirección: se distinguen por ?ofertas=1. Los enlaces a una parte de la página (#) no se marcan.
 */
function isCurrent(href: string, pathname: string, search: string): boolean {
  if (href.includes("#")) return false;
  const [path, query = ""] = href.split("?");
  if (path !== pathname) return false;
  // Ofertas y «Mujer» son la misma página de productos con otra dirección: se comparan esas partes.
  const here = new URLSearchParams(search);
  const link = new URLSearchParams(query);
  return ["ofertas", "para"].every((k) => (here.get(k) ?? "") === (link.get(k) ?? ""));
}

const CURRENT = "bg-sky-100 font-bold text-sky-950";
/** Grupos del menú del celular («Más categorías», «Conocenos»): en un recuadro, para que el título no parezca un enlace más. */
const GROUP = "rounded-3xl bg-cream p-2 ring-1 ring-line/70";
const GROUP_TITLE = "flex items-center gap-2 border-b border-line/80 px-3 pt-1.5 pb-2.5 mb-1 text-sm font-extrabold text-coral-deep";

export function Header({ categories }: { categories: NavCategory[] }) {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar menús al navegar
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    setSearchOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  // Deslizar desde el borde izquierdo hacia la derecha abre el menú; deslizar hacia la izquierda lo cierra.
  useEffect(() => {
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    let from: { x: number; y: number; edge: boolean } | null = null;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      from = e.touches.length === 1 ? { x: t.clientX, y: t.clientY, edge: t.clientX <= 60 } : null;
    };
    const onEnd = (e: TouchEvent) => {
      if (!from) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - from.x;
      const dy = t.clientY - from.y;
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.6;
      if (horizontal && !open && from.edge && dx >= 60) setOpen(true);
      else if (horizontal && open && dx <= -60) setOpen(false);
      from = null;
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchend", onEnd);
    };
  }, [open]);

  const links = [
    { href: "/productos", label: "Todos los productos" },
    { href: "/productos?ofertas=1", label: "Ofertas" },
    ...categories.slice(0, 4).map((c) => ({ href: `/categorias/${c.slug}`, label: c.name })),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur-md supports-[backdrop-filter]:bg-cream/85">
      <p className="bg-coral-deep px-4 py-1.5 text-center text-xs font-extrabold tracking-wide text-white sm:text-sm">
        ✨ Productos Natura a precios especiales · Pagá con Mercado Pago, transferencia o efectivo ✨
      </p>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:h-18 sm:gap-4 sm:px-6">
        <button
          type="button"
          className="-ml-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-forest/5 lg:hidden"
          aria-label="Abrir menú"
          aria-expanded={open}
          aria-controls="menu-movil"
          onClick={() => setOpen(true)}
        >
          <Menu className="size-6" aria-hidden="true" />
        </button>

        <Logo className="shrink-0" />

        <nav aria-label="Principal" className="ml-6 hidden lg:block">
          <ul className="flex items-center gap-1">
            {links.map((l, i) => (
              // En pantallas medianas entran solo las 2 primeras categorías; el resto, desde pantallas grandes.
              <li key={l.href} className={i >= 4 ? "hidden 2xl:block" : i >= 2 ? "hidden xl:block" : undefined}>
                <Link
                  href={l.href}
                  className="rounded-full px-3 py-2 text-[0.95rem] font-bold whitespace-nowrap text-forest transition-colors hover:bg-sun"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto hidden w-full max-w-xs md:block">
          <SearchBox />
        </div>

        <div className="ml-auto flex items-center md:ml-0">
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-full hover:bg-forest/5 md:hidden"
            aria-label="Buscar"
            aria-expanded={searchOpen}
            onClick={() => setSearchOpen((v) => !v)}
          >
            <Search className="size-5.5" aria-hidden="true" />
          </button>
          <Link
            href="/contacto"
            className="hidden size-11 items-center justify-center rounded-full hover:bg-forest/5 sm:inline-flex"
            aria-label="Contacto"
          >
            <MessageCircle className="size-5.5" aria-hidden="true" />
          </Link>
          <AccountMenu />
          <OrdersLink />
          <CartLink />
        </div>
      </div>
      <OrderReminder />
      <CartDrawer />

      {searchOpen ? (
        <div className="border-t border-line/70 px-4 py-3 md:hidden">
          <SearchBox autoFocus onDone={() => setSearchOpen(false)} />
        </div>
      ) : null}

      {/* Portal: el backdrop-blur del header encierra a los hijos "fixed" dentro de su caja. */}
      {open
        ? createPortal(
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <button
            type="button"
            className="absolute inset-0 bg-forest/30 backdrop-blur-[2px]"
            aria-label="Cerrar menú"
            tabIndex={-1}
            onClick={() => setOpen(false)}
          />
          <div
            id="menu-movil"
            ref={menuRef}
            className="animate-rise absolute inset-y-0 left-0 flex w-[min(86vw,340px)] flex-col gap-6 overflow-y-auto bg-warm-white p-5 shadow-lift"
          >
            <div className="flex items-center justify-between">
              <Logo />
              <button
                type="button"
                className="inline-flex size-11 items-center justify-center rounded-full hover:bg-forest/5"
                aria-label="Cerrar menú"
                onClick={() => setOpen(false)}
              >
                <X className="size-6" aria-hidden="true" />
              </button>
            </div>
            <InstallAppButton className="flex min-h-12 items-center gap-3 rounded-2xl bg-sun/60 px-4 text-lg font-semibold hover:bg-sun" />
            <nav aria-label="Menú móvil" className="flex flex-col gap-4">
              {[
                {
                  title: "Comprar",
                  Icon: ShoppingBag,
                  items: [
                    { href: "/", label: "Inicio" },
                    { href: "/productos", label: "Todos los productos" },
                    { href: "/productos?ofertas=1", label: "Ofertas" },
                  ],
                },
                {
                  title: "Mi compra",
                  Icon: Package,
                  items: [
                    { href: "/carrito", label: "Mi carrito" },
                    { href: "/mi-pedido", label: "Seguir mi pedido" },
                    { href: "/cuenta", label: "Mi cuenta" },
                    { href: "/club", label: "Club Natu Mariel 🎁" },
                  ],
                },
                {
                  title: "Categorías",
                  Icon: LayoutGrid,
                  items: categories.flatMap((c) => {
                    const items = [{ href: `/categorias/${c.slug}`, label: c.name }];
                    // No hay categoría «Mujer»: va el filtro «para mujer», al lado de «Hombre».
                    if (c.slug === "hombre") items.unshift({ href: "/productos?para=mujer", label: "Mujer" });
                    return items;
                  }),
                },
                {
                  title: "Conocenos",
                  Icon: Heart,
                  items: [
                    { href: "/quienes-somos", label: "Quiénes somos" },
                    { href: "/como-comprar", label: "Cómo comprar" },
                    { href: "/#calificaciones", label: "Reseñas" },
                    { href: "/contacto", label: "Contacto" },
                  ],
                },
              ]
                .filter((g) => g.items.length > 0)
                .map(({ title, Icon, items }) => (
                  <div key={title} className={GROUP}>
                    <p className={GROUP_TITLE}>
                      <Icon className="size-4" aria-hidden="true" /> {title}
                    </p>
                    <ul className="flex flex-col gap-0.5">
                      {items.map((l) => {
                        // El menú solo existe en el navegador (se abre con un toque), así que se puede leer la dirección.
                        const current = isCurrent(l.href, pathname, window.location.search);
                        return (
                          <li key={l.href}>
                            <Link
                              href={l.href}
                              onClick={() => setOpen(false)}
                              aria-current={current ? "page" : undefined}
                              className={`flex min-h-11 items-center rounded-2xl px-4 text-[1.05rem] hover:bg-sun ${current ? CURRENT : "font-semibold"}`}
                            >
                              {l.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
            </nav>
          </div>
        </div>,
            document.body,
          )
        : null}
    </header>
  );
}
