import Link from "next/link";

import { InstallAppButton } from "./install-app";
import { LeafMark } from "./logo";

export function Footer({ categories }: { categories: { name: string; slug: string }[] }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-auto bg-forest text-white">
      <svg viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true" className="block h-8 w-full -translate-y-px bg-cream sm:h-12">
        <path d="M0 30 C 120 0 240 60 360 30 S 600 0 720 30 S 960 60 1080 30 S 1320 0 1440 30 V60 H0 Z" fill="var(--forest)" />
      </svg>
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="col-span-2 max-w-sm md:col-span-1">
          <p className="flex items-center gap-2 font-display text-3xl font-bold">
            <LeafMark className="size-9" />
            Natu <span className="text-pink">Mariel</span>
          </p>
          <p className="mt-3 text-white/80">
            Tus favoritos de Natura a precios especiales, con atención cercana y personalizada.
          </p>
          <p className="mt-4 text-sm text-white/80">
            Revendedora independiente. Natura es una marca registrada de sus respectivos titulares.
          </p>
        </div>
        <nav aria-label="Tienda">
          <p className="text-xs font-bold tracking-[0.14em] text-white/80 uppercase">Tienda</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <Link className="hover:text-sun" href="/productos">
                Todos los productos
              </Link>
            </li>
            <li>
              <Link className="hover:text-sun" href="/productos?ofertas=1">
                Ofertas
              </Link>
            </li>
            {categories.slice(0, 6).map((c) => (
              <li key={c.slug}>
                <Link className="hover:text-sun" href={`/categorias/${c.slug}`}>
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Ayuda">
          <p className="text-xs font-bold tracking-[0.14em] text-white/80 uppercase">Ayuda</p>
          <ul className="mt-3 flex flex-col gap-2">
            <li>
              <Link className="hover:text-sun" href="/quienes-somos">
                Quiénes somos
              </Link>
            </li>
            <li>
              <Link className="hover:text-sun" href="/contacto">
                Contacto
              </Link>
            </li>
            <li>
              <Link className="hover:text-sun" href="/carrito">
                Mi carrito
              </Link>
            </li>
            <li>
              <Link className="hover:text-sun" href="/mi-pedido">
                Seguir mi pedido
              </Link>
            </li>
            <li>
              <Link className="hover:text-sun" href="/como-comprar">
                Cómo comprar
              </Link>
            </li>
            <li>
              <Link className="hover:text-sun" href="/#calificaciones">
                Reseñas
              </Link>
            </li>
            <li>
              <InstallAppButton className="inline-flex items-center gap-2 font-semibold hover:text-sun" />
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/15">
        <p className="mx-auto max-w-7xl px-4 py-5 text-sm text-white/80 sm:px-6">
          © {year} Natu Mariel. Precios en pesos argentinos (ARS). Pedidos sujetos a confirmación.{" "}
          <Link href="/privacidad" className="text-white/50 underline-offset-2 hover:text-white hover:underline">
            Privacidad
          </Link>{" "}
          ·{" "}
          <Link href="/admin" className="text-white/50 underline-offset-2 hover:text-white hover:underline">
            Acceso administradoras
          </Link>
        </p>
      </div>
    </footer>
  );
}
