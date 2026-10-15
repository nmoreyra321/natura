import { ArrowRight, CircleCheck, Gift, MessageCircle, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { ActiveCampaign, PublicCategory, PublicProduct, ReviewSummary } from "@/lib/catalog";
import { formatARS } from "@/lib/format";
import { GIFT_EVERY } from "@/lib/loyalty";
import { productImageUrl } from "@/lib/images";
import { getPriceInfo } from "@/lib/pricing";
import { LinkButton } from "@/components/ui/button";
import { AddReview } from "./add-review";
import { ClubProgressCard } from "./club-progress";
import { EmptyStore } from "./empty-store";
import { InfiniteCarousel } from "./infinite-carousel";
import { HeroArt } from "./hero-art";
import { LeafMark } from "./logo";
import { ProductRail } from "./product-card";
import { Stars } from "./stars";

export type HomeData = {
  hasProducts: boolean;
  categories: PublicCategory[];
  offers: PublicProduct[];
  bestSellers: PublicProduct[];
  featured: PublicProduct[];
  latest: PublicProduct[];
  /** Hasta 3 productos con foto para la portada. */
  heroProducts: PublicProduct[];
  whatsappUrl: string | null;
  /** Fecha especial activa (Día de la Madre…) y sus productos. */
  campaign: (ActiveCampaign & { products: PublicProduct[] }) | null;
  /** Club de clientas: monto mínimo del pedido para que sume (en centavos). */
  clubMinCents: number;
  /** Reseñas de clientas (promedio, cantidad y las últimas). */
  reviews: ReviewSummary | null;
};

const reviewDateFmt = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });

/** «Calificaciones»: franja de color con el promedio, carrusel de reseñas y botón para dejar una. */
export function ReviewsSection({ r }: { r: ReviewSummary | null }) {
  const cards = (r?.latest ?? []).map((rev) => (
    <li key={rev.id} className="flex w-[80%] shrink-0 snap-start flex-col rounded-3xl bg-white p-5 shadow-soft sm:w-[45%] lg:w-[31%]">
      <Stars value={rev.rating} />
      {rev.comment ? <p className="mt-2 text-forest/90">“{rev.comment}”</p> : null}
      <p className="mt-3 text-sm font-bold">
        {rev.name}
        <span className="block text-xs font-semibold text-muted first-letter:uppercase">{reviewDateFmt.format(new Date(rev.createdAt))}</span>
      </p>
      <span className="flex-1" />
      {rev.reply ? (
        <p className="mt-3 rounded-2xl bg-blush/60 p-3 text-sm">
          <b className="block text-coral-deep">Respuesta de Mariel</b>
          {rev.reply}
        </p>
      ) : null}
    </li>
  ));

  return (
    <section id="calificaciones" className="scroll-mt-24 px-3 py-4 sm:px-6" aria-labelledby="resenas">
      <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-lilac via-pink/70 to-blush p-6 sm:p-8">
        <span aria-hidden="true" className="pointer-events-none absolute -top-20 -left-16 size-64 rounded-full bg-white/50 blur-3xl" />
        <div className="relative mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-sm font-extrabold text-coral-deep">
              <MessageCircle className="size-4" aria-hidden="true" /> Opiniones reales
            </p>
            <h2 id="resenas" className="mt-3 font-display text-3xl leading-tight font-bold sm:text-4xl">
              Calificaciones ⭐
            </h2>
            {r ? (
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-display text-5xl leading-none font-bold tabular">{r.average.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</span>
                <span className="flex flex-col gap-0.5">
                  <Stars value={r.average} className="size-6" />
                  <span className="text-sm font-bold text-forest/70">
                    de 5 · {r.count} {r.count === 1 ? "reseña" : "reseñas"} de clientas
                  </span>
                </span>
              </p>
            ) : (
              <p className="mt-1 font-semibold text-forest/80">Todavía no hay reseñas. ¿Ya compraste? ¡Dejá la primera!</p>
            )}
          </div>
          <AddReview />
        </div>
        {cards.length >= 3 ? (
          <InfiniteCarousel label="Reseñas de clientas">{cards}</InfiniteCarousel>
        ) : cards.length > 0 ? (
          <ul aria-label="Reseñas de clientas" className="relative -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-2 pb-2 sm:mx-0 sm:px-1">
            {cards}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

const untilFmt = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Lo que más le importa a la clienta antes de comprar (se muestra como texto con tildes, no como botones). */
const PERKS = ["Hace 4 años vendiendo Natura", "Productos 100% originales", "Pagás con Mercado Pago o efectivo", "Sumá compras y ganá regalos"];

const CATEGORY_TINTS = ["bg-pink", "bg-sun", "bg-sage", "bg-lilac", "bg-peach"];

function SectionHeader({ title, subtitle, href }: { title: string; subtitle?: string; href: string }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-2xl font-bold sm:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm font-semibold text-muted sm:text-base">{subtitle}</p> : null}
      </div>
      <Link
        href={href}
        className="group inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-sm font-bold text-coral-deep transition-colors hover:bg-coral-soft"
      >
        Ver todo <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 ${className}`}>{children}</section>;
}

/** Tarjetita de producto flotando en la portada. */
function HeroProduct({ product, className }: { product: PublicProduct; className: string }) {
  const img = product.images[0];
  const src = img ? productImageUrl(img.storage_path) : null;
  const info = getPriceInfo(product.magazine_price, product.sale_price);
  return (
    <Link
      href={`/productos/${product.slug}`}
      className={`absolute block rounded-[1.75rem] bg-white p-2 shadow-lift ring-1 ring-white transition-transform duration-300 hover:z-20 hover:scale-[1.04] ${className}`}
    >
      <span className="relative block aspect-square overflow-hidden rounded-[1.35rem] bg-cream">
        {src ? <Image src={src} alt={product.name} fill sizes="(min-width: 768px) 260px, 45vw" className="object-cover" priority /> : null}
      </span>
      <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-forest px-3 py-1 text-sm font-bold whitespace-nowrap text-white shadow-soft tabular">
        {formatARS(info.saleCents)}
      </span>
      {info.hasDiscount && info.discountPercent >= 1 ? (
        <span className="absolute -top-2 -right-2 flex size-12 items-center justify-center rounded-full border-[3px] border-white bg-coral-deep font-display text-sm font-bold text-white shadow-soft tabular">
          −{info.discountPercent}%
        </span>
      ) : null}
    </Link>
  );
}

/** Inicio de la tienda. */
export function HomeView({ d }: { d: HomeData }) {
  const [a, b, c] = d.heroProducts;
  const hasOffers = d.offers.length > 0;

  return (
    <>
      {d.campaign ? (
        <div className="px-3 pt-3 sm:px-6 sm:pt-5">
          <Link
            href={`/especial/${d.campaign.slug}`}
            className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 rounded-3xl bg-gradient-to-r from-coral-deep to-grape px-5 py-3.5 text-white shadow-lift transition hover:brightness-110"
          >
            <span>
              <span className="block font-display text-lg leading-tight font-bold sm:text-xl">{d.campaign.title}</span>
              {d.campaign.message ? <span className="block text-sm opacity-90">{d.campaign.message}</span> : null}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-coral-deep">
              Ver regalos <ArrowRight className="size-4" aria-hidden="true" />
            </span>
          </Link>
        </div>
      ) : null}

      {/* Portada */}
      <section className="px-3 pt-3 sm:px-6 sm:pt-5">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-blush via-pink/70 to-lilac sm:rounded-[2.5rem]">
          <div aria-hidden="true" className="pointer-events-none absolute inset-0">
            <div className="absolute -top-24 -left-16 size-72 rounded-full bg-white/60 blur-3xl" />
            <div className="absolute -right-20 -bottom-24 size-96 rounded-full bg-sun/50 blur-3xl" />
            <LeafMark className="absolute top-6 right-[42%] hidden size-10 rotate-12 opacity-40 md:block" />
          </div>
          <div className="relative grid items-center gap-8 px-5 py-8 sm:px-10 sm:py-12 md:grid-cols-[1.05fr_1fr] md:py-16">
            <div className="animate-rise">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3.5 py-1.5 text-sm font-extrabold text-coral-deep shadow-soft backdrop-blur">
                <Sparkles className="size-4" aria-hidden="true" /> Belleza natural a precios especiales
              </p>
              <h1 className="mt-5 font-display text-[2.5rem] leading-[1.02] font-bold tracking-tight sm:text-6xl lg:text-[4.2rem]">
                Natura te encanta.{" "}
                <span className="text-coral-deep">Nuestros precios,</span>{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">todavía más.</span>
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-1 h-3.5 -rotate-1 rounded-full bg-sun sm:h-5" />
                </span>
              </h1>
              <p className="mt-5 max-w-lg text-base font-semibold text-muted sm:text-lg">
                Tus productos favoritos de perfumería, cuidado de la piel y maquillaje, más baratos que en la revista.
              </p>
              {d.hasProducts ? (
                <div className="mt-7 flex flex-wrap gap-3">
                  <LinkButton href="/productos" size="lg" className="shadow-lift">
                    Ver productos <ArrowRight className="size-5" aria-hidden="true" />
                  </LinkButton>
                  {hasOffers ? (
                    <LinkButton href="/productos?ofertas=1" size="lg" variant="outline" className="bg-white/70">
                      Ver ofertas
                    </LinkButton>
                  ) : null}
                </div>
              ) : null}
              {d.reviews ? (
                <a
                  href="#calificaciones"
                  className="mt-6 inline-flex flex-wrap items-center gap-2 rounded-full bg-white/85 px-4 py-2 text-sm font-bold shadow-soft transition hover:bg-white"
                >
                  <Stars value={d.reviews.average} />
                  <span className="tabular">{d.reviews.average.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</span>
                  <span className="text-muted">
                    · {d.reviews.count} {d.reviews.count === 1 ? "reseña" : "reseñas"}
                  </span>
                  <ArrowRight className="size-4 text-coral-deep" aria-hidden="true" />
                </a>
              ) : null}
              <ul aria-label="Por qué comprar acá" className="mt-6 grid max-w-lg gap-x-5 gap-y-2 text-sm font-bold text-forest sm:grid-cols-2">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-center gap-2">
                    <CircleCheck className="size-[1.1rem] shrink-0 text-botanical-deep" aria-hidden="true" />
                    {perk}
                  </li>
                ))}
              </ul>
            </div>

            {a ? (
              <div className="relative mx-auto aspect-[1.1] w-full max-w-md md:max-w-none" aria-label="Algunos de nuestros productos">
                <HeroProduct product={a} className="top-[4%] left-[20%] z-10 w-[56%] -rotate-3" />
                {b ? <HeroProduct product={b} className="top-[40%] left-0 w-[40%] rotate-[-8deg]" /> : null}
                {c ? <HeroProduct product={c} className="top-[46%] right-0 w-[40%] rotate-[7deg]" /> : null}
              </div>
            ) : (
              <HeroArt className="mx-auto w-full max-w-md md:max-w-none" />
            )}
          </div>
        </div>
      </section>

      {!d.hasProducts ? (
        <EmptyStore />
      ) : (
        <>
          {d.campaign && d.campaign.products.length > 0 ? (
            <Section>
              <SectionHeader
                title={d.campaign.title}
                subtitle={`Hasta el ${untilFmt.format(new Date(`${d.campaign.endsOn}T12:00:00Z`))}`}
                href={`/especial/${d.campaign.slug}`}
              />
              <ProductRail products={d.campaign.products.slice(0, 8)} />
            </Section>
          ) : null}

          {d.categories.length > 0 ? (
            <Section>
              <SectionHeader title="Comprá por categoría" href="/productos" />
              <InfiniteCarousel label="Categorías">
                {d.categories.map((cat, i) => {
                  const src = cat.image ? productImageUrl(cat.image) : null;
                  return (
                    <li key={cat.id} className="w-[30%] shrink-0 snap-start sm:w-[22%] md:w-[18%] lg:w-[15%]">
                      <Link href={`/categorias/${cat.slug}`} className="group flex flex-col items-center gap-2 text-center">
                        <span
                          className={`relative block aspect-square w-full overflow-hidden rounded-[1.75rem] ${CATEGORY_TINTS[i % CATEGORY_TINTS.length]} ring-1 ring-line/70 transition duration-300 group-hover:-translate-y-1 group-hover:shadow-lift`}
                        >
                          {src ? (
                            <Image src={src} alt="" fill sizes="(min-width: 1024px) 15vw, 30vw" className="object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-105" />
                          ) : (
                            <LeafMark className="absolute inset-0 m-auto size-10 opacity-70" />
                          )}
                        </span>
                        <span className="text-sm leading-tight font-bold">
                          {cat.name}
                          <span className="block text-xs font-semibold text-muted tabular">{cat.productCount} productos</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </InfiniteCarousel>
            </Section>
          ) : null}

          <ReviewsSection r={d.reviews} />

          {/* Club de clientas */}
          <section className="px-3 py-4 sm:px-6" aria-labelledby="club">
            <div className="relative mx-auto grid max-w-7xl gap-6 overflow-hidden rounded-[2rem] bg-gradient-to-br from-sun via-peach to-blush p-6 sm:p-8 md:grid-cols-[1.3fr_1fr] md:items-center">
              <span aria-hidden="true" className="pointer-events-none absolute -right-16 -bottom-20 size-64 rounded-full bg-white/50 blur-3xl" />
              <div className="relative">
                <p className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-sm font-extrabold text-coral-deep">
                  <Gift className="size-4" aria-hidden="true" /> Club Natu Mariel
                </p>
                <h2 id="club" className="mt-3 font-display text-3xl leading-tight font-bold sm:text-4xl">
                  Cada {GIFT_EVERY} compras, <span className="text-coral-deep">¡un regalo!</span>
                </h2>
                {d.clubMinCents > 0 ? (
                  <p className="mt-1 text-sm font-bold text-forest/70">Suman las compras de {formatARS(d.clubMinCents)} o más.</p>
                ) : null}
                <p className="mt-2 max-w-lg font-semibold text-forest/80">
                  No tenés que anotarte en nada: tus compras se suman solas con tu número de WhatsApp.
                </p>
                <ol className="mt-4 flex flex-col gap-2 text-sm font-bold sm:text-base">
                  {[
                    "Comprá como siempre: en la tienda, por WhatsApp o en los vivos.",
                    d.clubMinCents > 0
                      ? `Cada pedido de ${formatARS(d.clubMinCents)} o más, pagado completo, suma una compra.`
                      : "Cada pedido pagado completo suma una compra.",
                    `En tu compra número ${GIFT_EVERY}, Mariel te regala algo especial 💝`,
                  ].map((t, i) => (
                    <li key={t} className="flex items-start gap-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-forest text-xs text-white">{i + 1}</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ol>
                <Link href="/productos" className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-coral-deep px-6 font-bold text-white shadow-lift transition hover:-translate-y-0.5">
                  Empezar a sumar <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </div>
              <ClubProgressCard minCents={d.clubMinCents} />
            </div>
          </section>

          {hasOffers ? (
            <Section>
              <SectionHeader title="Ofertas para vos 🔥" subtitle="Aprovechá, son por tiempo limitado" href="/productos?ofertas=1" />
              <ProductRail products={d.offers.slice(0, 8)} />
            </Section>
          ) : null}

          {d.bestSellers.length >= 4 ? (
            <Section>
              <SectionHeader title="Los más vendidos 🏆" subtitle="Lo que más se llevan nuestras clientas" href="/productos" />
              <ProductRail products={d.bestSellers.slice(0, 8)} />
            </Section>
          ) : null}

          {/* Llamado a WhatsApp */}
          {d.whatsappUrl ? (
            <section className="px-3 py-4 sm:px-6">
              <div className="relative mx-auto flex max-w-7xl flex-col items-start gap-4 overflow-hidden rounded-[2rem] bg-gradient-to-br from-forest via-grape to-coral-deep p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
                <span aria-hidden="true" className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-coral/40 blur-3xl" />
                <div className="relative">
                  <p className="font-display text-2xl font-bold sm:text-3xl">¿No sabés qué elegir?</p>
                  <p className="mt-1 max-w-xl font-semibold text-white/85">
                    Escribile a Mariel: te recomienda el perfume o la crema ideal y te cuenta las ofertas de la semana.
                  </p>
                  <Link href="/quienes-somos" className="mt-2 inline-block text-sm font-bold text-white underline underline-offset-4">
                    Conocé a Mariel y sus vivos en Facebook →
                  </Link>
                </div>
                <a
                  href={d.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full bg-white px-6 font-bold text-forest shadow-lift transition hover:-translate-y-0.5"
                >
                  <MessageCircle className="size-5 text-botanical-deep" aria-hidden="true" /> Escribir por WhatsApp
                </a>
              </div>
            </section>
          ) : null}

          {d.featured.length > 0 ? (
            <Section>
              <SectionHeader title="Los más elegidos 💖" subtitle="Los favoritos de Mariel" href="/productos" />
              <ProductRail products={d.featured.slice(0, 8)} />
            </Section>
          ) : null}

          <Section className="pb-14">
            <SectionHeader title="Novedades ✨" subtitle="Lo último que llegó a la tienda" href="/productos?orden=nuevos" />
            <ProductRail products={d.latest.slice(0, 8)} />
          </Section>
        </>
      )}
    </>
  );
}
