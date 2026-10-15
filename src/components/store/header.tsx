"use client";

import { ChevronRight, Menu, MessageCircle, Package, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cartCount, cartDrawer, useCart } from "@/lib/cart-store";
import { hideOrderReminder, useRecentOrder, useSavedOrders } from "@/lib/my-orders";
import { CartDrawer } from "./cart-drawer";
import { Logo } from "./logo";
import { InstallAppButton } from "./install-app";
import { SearchBox } from "./search-box";

type NavCategory = { name: string; slug: string };

function CartLink() {
  const items = useCart();
  const pathname = usePathname();
  const count = cartCount(items);
  const label = count > 0 ? `Carrito: ${count} ${count === 1 ? "producto" : "productos"}` : "Carrito vacío";
  const badge =
    count > 0 ? (
      <span
        className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-coral-deep px-1.5 text-[0.7rem] leading-5 font-bold text-white tabular ring-2 ring-cream"
        aria-hidden="true"
      >
        {count > 99 ? "99+" : count}
      </span>
    ) : null;
  const classes =
    "relative inline-flex size-11 items-center justify-center rounded-full text-forest transition-colors hover:bg-forest/5";
  // En la página del carrito el ícono no abre el panel: ya está todo a la vista.
  if (pathname === "/carrito") {
    return (
      <Link href="/carrito" className={classes} aria-label={label}>
        <ShoppingBag className="size-6" aria-hidden="true" />
        {badge}
      </Link>
    );
  }
  return (
    <button type="button" className={classes} aria-label={label} aria-haspopup="dialog" onClick={() => cartDrawer.open()}>
      <ShoppingBag className="size-6" aria-hidden="true" />
      {badge}
    </button>
  );
}

/** Ícono "Mis pedidos", con un puntito si hay pedidos hechos desde este celular. */
function OrdersLink() {
  const saved = useSavedOrders();
  return (
    <Link
      href="/mi-pedido"
      className="relative inline-flex size-11 items-center justify-center rounded-full text-forest transition-colors hover:bg-forest/5"
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

  const links = [
    { href: "/productos", label: "Todos los productos" },
    { href: "/productos?ofertas=1", label: "Ofertas" },
    ...categories.slice(0, 4).map((c) => ({ href: `/categorias/${c.slug}`, label: c.name })),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/95 backdrop-blur-md supports-[backdrop-filter]:bg-cream/85">
      <p className="bg-coral-deep px-4 py-1.5 text-center text-xs font-extrabold tracking-wide text-white sm:text-sm">
        ✨ Productos Natura a precios especiales · Pedidos por WhatsApp ✨
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
            <nav aria-label="Menú móvil">
              <ul className="flex flex-col gap-1">
                {[
                  ...links,
                  { href: "/mi-pedido", label: "Seguir mi pedido" },
                  { href: "/carrito", label: "Mi carrito" },
                  { href: "/como-comprar", label: "Cómo comprar" },
                  { href: "/contacto", label: "Contacto" },
                ].map(
                  (l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="flex min-h-12 items-center rounded-2xl px-4 text-lg font-semibold hover:bg-sun"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </nav>
            <InstallAppButton className="flex min-h-12 items-center gap-3 rounded-2xl bg-sun/60 px-4 text-lg font-semibold hover:bg-sun" />
            {categories.length > 4 ? (
              <div>
                <p className="px-4 pb-2 text-xs font-bold tracking-[0.14em] text-muted uppercase">Más categorías</p>
                <ul className="flex flex-col gap-1">
                  {categories.slice(4).map((c) => (
                    <li key={c.slug}>
                      <Link href={`/categorias/${c.slug}`} className="flex min-h-11 items-center rounded-2xl px-4 hover:bg-sun">
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>,
            document.body,
          )
        : null}
    </header>
  );
}
