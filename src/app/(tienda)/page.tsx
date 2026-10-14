import { ArrowRight, Heart, MessageCircle, Sparkles, Tag } from "lucide-react";
import Link from "next/link";

import { LinkButton } from "@/components/ui/button";
import { EmptyStore } from "@/components/store/empty-store";
import { HeroArt, Wave } from "@/components/store/hero-art";
import { ProductGrid } from "@/components/store/product-card";
import { getActiveCategories, getBestSellers, getHighlights, getPublishedCount } from "@/lib/catalog";

export const revalidate = 300;

const CHIP_COLORS = [
  "bg-pink hover:bg-coral-deep hover:text-white",
  "bg-sun hover:bg-tangerine",
  "bg-sage hover:bg-botanical hover:text-white",
  "bg-lilac hover:bg-grape hover:text-white",
  "bg-peach hover:bg-tangerine",
];

function Section({
  title,
  href,
  emoji,
  children,
}: {
  title: string;
  href: string;
  emoji: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-7 flex items-end justify-between gap-4">
        <h2 className="flex items-center gap-2 font-display text-3xl font-bold sm:text-4xl">
          <span className="wavy-underline">{title}</span>
          {emoji}
        </h2>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 rounded-full bg-forest px-4 py-2 text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
        >
          Ver todo <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {children}
    </section>
  );
}

const PERKS = [
  { icon: Tag, text: "Precios más bajos que la revista", color: "bg-sun" },
  { icon: MessageCircle, text: "Pedís por WhatsApp, sin registrarte", color: "bg-pink" },
  { icon: Heart, text: "Atención personalizada de Mariel", color: "bg-sage" },
];

export default async function HomePage() {
  const [count, categories, highlights, bestSellers] = await Promise.all([
    getPublishedCount(),
    getActiveCategories(),
    getHighlights(8),
    getBestSellers(8),
  ]);
  const hasProducts = (count ?? 0) > 0;
  const hasOffers = highlights.offers.length > 0;

  return (
    <>
      <section className="relative overflow-hidden">
        {/* manchas de color de fondo */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-24 -left-24 size-72 rounded-full bg-pink/70 blur-3xl" />
          <div className="absolute top-40 -right-20 size-80 rounded-full bg-sun/50 blur-3xl" />
          <div className="absolute -bottom-20 left-1/3 size-72 rounded-full bg-lilac/80 blur-3xl" />
        </div>
        <div className="mx-auto grid max-w-7xl items-center gap-6 px-4 pt-8 pb-10 sm:px-6 md:grid-cols-[1.1fr_1fr] md:pt-14 md:pb-16">
          <div className="animate-rise">
            <p className="inline-flex -rotate-2 items-center gap-2 rounded-full bg-forest px-4 py-1.5 text-sm font-extrabold text-sun shadow-soft">
              <Sparkles className="size-4" aria-hidden="true" /> Belleza natural a precios especiales
            </p>
            <h1 className="mt-5 font-display text-[2.6rem] leading-[1.02] font-bold tracking-tight sm:text-[4.2rem]">
              Natura te encanta.{" "}
              <span className="relative inline-block text-coral-deep">
                Nuestros precios,
              </span>{" "}
              <span className="relative inline-block">
                <span className="relative z-10">todavía más.</span>
                <span aria-hidden="true" className="absolute inset-x-0 bottom-1 -z-0 h-4 -rotate-1 rounded-full bg-sun sm:h-5" />
              </span>
            </h1>
            <p className="mt-5 max-w-lg text-lg font-semibold text-muted">
              Encontrá tus productos favoritos de belleza y cuidado personal a precios especiales.
            </p>
            {hasProducts ? (
              <div className="mt-8 flex flex-wrap gap-3">
                <LinkButton href="/productos" size="lg" className="shadow-lift">
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
          <div className="relative">
            <HeroArt className="mx-auto w-full max-w-md md:max-w-none" />
            <span
              aria-hidden="true"
              className="animate-wiggle absolute top-4 right-2 flex size-24 flex-col items-center justify-center rounded-full border-4 border-white bg-coral-deep text-center font-display text-lg leading-tight font-bold text-white shadow-lift sm:top-8 sm:right-6 sm:size-28 sm:text-xl"
            >
              ¡Precios
              <br />
              top!
            </span>
          </div>
        </div>
      </section>

      <Wave color="var(--forest)" />
      <section className="bg-forest text-white" aria-label="Beneficios">
        <ul className="mx-auto grid max-w-7xl gap-3 px-4 py-6 sm:grid-cols-3 sm:px-6">
          {PERKS.map((p) => (
            <li key={p.text} className="flex items-center gap-3 font-bold">
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${p.color} text-forest`}>
                <p.icon className="size-5" aria-hidden="true" />
              </span>
              {p.text}
            </li>
          ))}
        </ul>
      </section>
      <Wave color="var(--forest)" className="rotate-180" />

      {!hasProducts ? (
        <EmptyStore />
      ) : (
        <>
          {categories.length > 0 ? (
            <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6" aria-labelledby="cat-title">
              <h2 id="cat-title" className="mb-4 font-display text-2xl font-bold">
                ¿Qué estás buscando?
              </h2>
              <ul className="flex flex-wrap gap-2.5">
                {categories.map((c, i) => (
                  <li key={c.id}>
                    <Link
                      href={`/categorias/${c.slug}`}
                      className={`inline-flex min-h-12 items-center gap-2 rounded-full border-2 border-forest px-5 font-bold shadow-[3px_3px_0_var(--forest)] transition-all hover:-translate-y-0.5 hover:shadow-[5px_5px_0_var(--forest)] ${CHIP_COLORS[i % CHIP_COLORS.length]}`}
                    >
                      {c.name}
                      <span className="rounded-full bg-white/80 px-2 text-sm text-forest tabular">{c.productCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {hasOffers ? (
            <Section title="Ofertas para vos" href="/productos?ofertas=1" emoji={<span aria-hidden="true">🔥</span>}>
              <ProductGrid products={highlights.offers.slice(0, 4)} />
            </Section>
          ) : null}
          {/* Se muestra cuando ya hay ventas suficientes para que la lista tenga sentido. */}
          {bestSellers.length >= 4 ? (
            <Section title="Los más vendidos" href="/productos" emoji={<span aria-hidden="true">🏆</span>}>
              <ProductGrid products={bestSellers.slice(0, bestSellers.length >= 8 ? 8 : 4)} />
            </Section>
          ) : null}
          {highlights.featured.length > 0 ? (
            <Section title="Los más elegidos" href="/productos" emoji={<span aria-hidden="true">💖</span>}>
              <ProductGrid products={highlights.featured.slice(0, 8)} />
            </Section>
          ) : null}
          <Section title="Novedades" href="/productos?orden=nuevos" emoji={<span aria-hidden="true">✨</span>}>
            <ProductGrid products={highlights.latest.slice(0, 8)} />
          </Section>
        </>
      )}
    </>
  );
}
