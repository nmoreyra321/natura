import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { LinkButton } from "@/components/ui/button";
import { EmptyStore } from "@/components/store/empty-store";
import { HeroArt } from "@/components/store/hero-art";
import { ProductGrid } from "@/components/store/product-card";
import { getActiveCategories, getHighlights, getPublishedCount } from "@/lib/catalog";

export const revalidate = 300;

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h2>
        <Link href={href} className="inline-flex items-center gap-1 font-semibold text-coral-deep hover:underline">
          Ver todo <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {children}
    </section>
  );
}

export default async function HomePage() {
  const [count, categories, highlights] = await Promise.all([
    getPublishedCount(),
    getActiveCategories(),
    getHighlights(8),
  ]);
  const hasProducts = (count ?? 0) > 0;
  const hasOffers = highlights.offers.length > 0;

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 pt-10 pb-12 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-16 md:pb-20">
          <div className="animate-rise">
            <p className="inline-flex items-center gap-2 rounded-full bg-sage px-3 py-1 text-sm font-bold text-botanical-deep">
              Belleza natural · precios especiales
            </p>
            <h1 className="mt-5 font-display text-[2.4rem] leading-[1.05] font-semibold tracking-tight sm:text-6xl">
              Natura te encanta.{" "}
              <span className="italic text-coral-deep">Nuestros precios, todavía más.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted">
              Encontrá tus productos favoritos de belleza y cuidado personal a precios especiales.
            </p>
            {hasProducts ? (
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href="/productos" size="lg">
                  Explorar productos
                </LinkButton>
                {hasOffers ? (
                  <LinkButton href="/productos?ofertas=1" size="lg" variant="outline">
                    Ver ofertas
                  </LinkButton>
                ) : null}
              </div>
            ) : null}
          </div>
          <HeroArt className="mx-auto w-full max-w-md md:max-w-none" />
        </div>
      </section>

      {!hasProducts ? (
        <EmptyStore />
      ) : (
        <>
          {categories.length > 0 ? (
            <section className="mx-auto max-w-7xl px-4 sm:px-6" aria-labelledby="cat-title">
              <h2 id="cat-title" className="sr-only">
                Categorías
              </h2>
              <ul className="flex flex-wrap gap-2.5">
                {categories.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/categorias/${c.slug}`}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-warm-white px-5 font-semibold shadow-soft transition-colors hover:border-coral hover:bg-blush"
                    >
                      {c.name}
                      <span className="text-sm text-muted tabular">{c.productCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {hasOffers ? (
            <Section title="Ofertas para vos" href="/productos?ofertas=1">
              <ProductGrid products={highlights.offers.slice(0, 4)} />
            </Section>
          ) : null}
          {highlights.featured.length > 0 ? (
            <Section title="Los más elegidos" href="/productos">
              <ProductGrid products={highlights.featured.slice(0, 8)} />
            </Section>
          ) : null}
          <Section title="Novedades" href="/productos?orden=nuevos">
            <ProductGrid products={highlights.latest.slice(0, 8)} />
          </Section>
        </>
      )}
    </>
  );
}
