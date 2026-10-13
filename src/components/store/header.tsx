"use client";

import { Menu, MessageCircle, Search, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { cartCount, useCart } from "@/lib/cart-store";
import { Logo } from "./logo";

type NavCategory = { name: string; slug: string };

function CartLink() {
  const items = useCart();
  const count = cartCount(items);
  return (
    <Link
      href="/carrito"
      className="relative inline-flex size-11 items-center justify-center rounded-full text-forest transition-colors hover:bg-forest/5"
      aria-label={count > 0 ? `Carrito: ${count} ${count === 1 ? "producto" : "productos"}` : "Carrito vacío"}
    >
      <ShoppingBag className="size-6" aria-hidden="true" />
      {count > 0 ? (
        <span
          className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-coral-deep px-1.5 text-[0.7rem] leading-5 font-bold text-white tabular"
          aria-hidden="true"
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

function SearchForm({ onDone, autoFocus = false }: { onDone?: () => void; autoFocus?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault();
        const term = q.trim();
        router.push(term ? `/productos?q=${encodeURIComponent(term)}` : "/productos");
        onDone?.();
      }}
    >
      <label htmlFor={id} className="sr-only">
        Buscar productos
      </label>
      <input
        id={id}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar perfumes, cremas, kits…"
        autoFocus={autoFocus}
        maxLength={80}
        enterKeyHint="search"
        className="h-11 w-full rounded-full border border-line bg-white pr-12 pl-4 text-base text-forest placeholder:text-muted/70 focus:border-botanical focus:ring-3 focus:ring-botanical/20 focus:outline-none"
      />
      <button
        type="submit"
        className="absolute top-1 right-1 inline-flex size-9 items-center justify-center rounded-full bg-botanical-deep text-white transition-colors hover:bg-[#245a3c]"
        aria-label="Buscar"
      >
        <Search className="size-4.5" aria-hidden="true" />
      </button>
    </form>
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
    { href: "/productos", label: "Productos" },
    { href: "/productos?ofertas=1", label: "Ofertas" },
    ...categories.slice(0, 4).map((c) => ({ href: `/categorias/${c.slug}`, label: c.name })),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-cream/90 backdrop-blur-md supports-[backdrop-filter]:bg-cream/75">
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
            {links.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className="rounded-full px-3.5 py-2 text-[0.95rem] font-semibold text-forest/85 transition-colors hover:bg-forest/5 hover:text-forest"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto hidden w-full max-w-xs md:block">
          <SearchForm />
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
          <CartLink />
        </div>
      </div>

      {searchOpen ? (
        <div className="border-t border-line/70 px-4 py-3 md:hidden">
          <SearchForm autoFocus onDone={() => setSearchOpen(false)} />
        </div>
      ) : null}

      {open ? (
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
                {[...links, { href: "/contacto", label: "Contacto" }, { href: "/carrito", label: "Mi carrito" }].map(
                  (l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="flex min-h-12 items-center rounded-2xl px-4 text-lg font-semibold hover:bg-blush"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </nav>
            {categories.length > 4 ? (
              <div>
                <p className="px-4 pb-2 text-xs font-bold tracking-[0.14em] text-muted uppercase">Más categorías</p>
                <ul className="flex flex-col gap-1">
                  {categories.slice(4).map((c) => (
                    <li key={c.slug}>
                      <Link href={`/categorias/${c.slug}`} className="flex min-h-11 items-center rounded-2xl px-4 hover:bg-blush">
                        {c.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
