import Link from "next/link";

import { LeafMark } from "./logo";

export function Footer({ categories }: { categories: { name: string; slug: string }[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto border-t border-line bg-warm-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm">
          <p className="flex items-center gap-2 font-display text-2xl font-semibold">
            <LeafMark className="size-7 text-botanical" />
            Natu <span className="italic text-coral-deep">Mariel</span>
          </p>
          <p className="mt-3 text-muted">
            Tus favoritos de Natura a precios especiales, con atención cercana y personalizada.
          </p>
          <p className="mt-4 text-sm text-muted">
            Revendedora independiente. Natura es una marca registrada de sus respectivos titulares.
          </p>
        </div>
        <nav aria-label="Tienda">
          <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Tienda</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <Link className="hover:text-coral-deep" href="/productos">
                Todos los productos
              </Link>
            </li>
            <li>
              <Link className="hover:text-coral-deep" href="/productos?ofertas=1">
                Ofertas
              </Link>
            </li>
            {categories.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link className="hover:text-coral-deep" href={`/categorias/${c.slug}`}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Ayuda">
          <p className="text-xs font-bold tracking-[0.14em] text-muted uppercase">Ayuda</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <Link className="hover:text-coral-deep" href="/contacto">
                Contacto
              </Link>
            </li>
            <li>
              <Link className="hover:text-coral-deep" href="/carrito">
                Mi carrito
              </Link>
            </li>
            <li>
              <Link className="hover:text-coral-deep" href="/contacto#como-comprar">
                Cómo comprar
              </Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 py-5 text-sm text-muted sm:px-6">
          © {year} Natu Mariel. Precios en pesos argentinos (ARS). Pedidos sujetos a confirmación.
        </p>
      </div>
    </footer>
  );
}
