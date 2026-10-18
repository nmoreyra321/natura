import { ArrowRight, CircleCheck, Gift, MessageCircle, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import type { ActiveCampaign, PublicCategory, PublicProduct, ReviewSummary } from "@/lib/catalog";
import { formatARS } from "@/lib/format";
import { GIFT_EVERY } from "@/lib/loyalty";
import { productImageUrl } from "@/lib/images";
import { getPriceInfo } from "@/lib/pricing";
import { LinkButton } from "@/components/ui/button";
import { ClubPitch } from "./club-cta";
import { ClubProgressCard } from "./club-progress";
import { EmptyStore } from "./empty-store";
import { HomeBanner, type BannerSlide } from "./home-banner";
import { InfiniteCarousel } from "./infinite-carousel";
import { HeroArt } from "./hero-art";
import { LeafMark } from "./logo";
import { ProductRail } from "./product-card";
import { ReviewsStrip } from "./reviews-strip";
import { pickStarProducts, StarProducts } from "./star-product";
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
  /** Para la fila final «Todos los productos». */
  more: PublicProduct[];
  totalProducts: number;
};

const reviewDateFmt = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });

/** «Calificaciones»: franja finita con el promedio; el carrusel de reseñas se abre al tocar «Ver reseñas». */
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

  const summary = (
    <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-display text-lg leading-tight font-bold sm:text-xl">Calificaciones</span>
      {r ? (
        <>
          <Stars value={r.average} />
          <span className="text-sm font-bold">
            <span className="tabular">{r.average.toLocaleString("es-AR", { maximumFractionDigits: 1 })}</span>
            <span className="font-semibold text-forest/70">
              {" "}
              · {r.count} {r.count === 1 ? "reseña" : "reseñas"}
            </span>
          </span>
        </>
      ) : (
        <span className="text-sm font-semibold text-forest/70">¡Dejá la primera reseña!</span>
      )}
    </h2>
  );

  return (
    <section id="calificaciones" className="scroll-mt-24 px-3 py-3 sm:px-6">
      <ReviewsStrip summary={summary} cards={cards} />
    </section>
  );
}

const untilFmt = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

/** Lo que más le importa a la clienta antes de comprar (se muestra como texto con tildes, no como botones). */
// Lo de pagar y lo del club ya está en la barra de arriba y en su propia sección: acá no se repite.
const PERKS = ["Más de 5 años vendiendo Natura", "Productos 100% originales", "Entregas en zona sur: a domicilio o en la estación"];

const CATEGORY_TINTS = ["bg-pink", "bg-sun", "bg-sage", "bg-lilac", "bg-peach"];

function SectionHeader({ title, subtitle, href, linkLabel = "Ver todo" }: { title: string; subtitle?: string; href: string; linkLabel?: string }) {
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
        {linkLabel} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 ${className}`}>{children}</section>;
}

/** Tarjetita de producto flotando en la portada. */
function HeroProduct({
  product,
  className,
  badgeLeft = false,
}: {
  product: PublicProduct;
  className: string;
  /** Etiqueta de descuento a la izquierda (si a la derecha la tapa otra tarjeta). */
  badgeLeft?: boolean;
}) {
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
        <span className={`absolute -top-2 ${badgeLeft ? "-left-2" : "-right-2"} flex size-12 items-center justify-center rounded-full border-[3px] border-white bg-coral-deep font-display text-sm font-bold text-white shadow-soft tabular`}>
          −{info.discountPercent}%
        </span>
      ) : null}
    </Link>
  );
}

/** Pasos para comprar, cortitos, al final del inicio. */
const BUY_STEPS = ["Elegís tus productos", "Pagás con Mercado Pago o en efectivo", "Te avisamos cuando está listo"];

function heroImage(p: PublicProduct | undefined): BannerSlide["image"] {
  const img = p?.images[0];
  const src = img ? productImageUrl(img.storage_path) : null;
  return p && src ? { src, alt: p.name } : undefined;
}

/** Inicio de la tienda. */
export function HomeView({ d }: { d: HomeData }) {
  const [a, b, c] = d.heroProducts;
  const hasOffers = d.offers.length > 0;
  const stars = pickStarProducts(d.offers);

  // El mayor descuento real entre las ofertas del momento (nunca un número inventado).
  const maxOff = d.offers.reduce((max, p) => Math.max(max, getPriceInfo(p.magazine_price, p.sale_price).discountPercent), 0);

  const slides: BannerSlide[] = [
    ...(hasOffers && maxOff >= 1
      ? [{ href: "/productos?ofertas=1", title: `Hasta ${maxOff}% menos que en la revista`, text: "Mirá las ofertas de hoy", cta: "Ver ofertas", tone: "from-coral-deep to-tangerine", image: heroImage(a) }]
      : [{ href: "/productos", title: "Productos Natura originales", text: "Perfumería, piel y maquillaje", cta: "Ver productos", tone: "from-coral-deep to-tangerine", image: heroImage(a) }]),
    { href: "/club", title: "Sumá compras, ganá regalos", text: `Cada ${GIFT_EVERY} compras, un regalo`, cta: "Mi club", tone: "from-grape to-coral-deep", image: heroImage(b) },
    { href: "/como-comprar", title: "Pagás como quieras", text: "Mercado Pago o efectivo", cta: "Cómo comprar", tone: "from-botanical-deep to-botanical", image: heroImage(c) },
  ];

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
          <div className="relative grid items-center gap-5 px-5 py-6 sm:gap-8 sm:px-10 sm:py-12 md:grid-cols-[1.05fr_1fr] md:py-16">
            <div className="animate-rise">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-extrabold text-coral-deep shadow-soft backdrop-blur sm:px-3.5 sm:py-1.5 sm:text-sm">
                <Sparkles className="size-4" aria-hidden="true" /> Revendedora de Natura en zona sur
              </p>
              <h1 className="mt-3 font-display text-[2.1rem] leading-[1.02] font-bold tracking-tight sm:mt-5 sm:text-6xl lg:text-[4.2rem]">
                Natura te encanta.{" "}
                <span className="text-coral-deep">Con nuestros precios,</span>{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">todavía más.</span>
                  <span aria-hidden="true" className="absolute inset-x-0 bottom-1 h-3.5 -rotate-1 rounded-full bg-sun sm:h-5" />
                </span>
              </h1>
              <p className="mt-3 max-w-lg text-[0.95rem] font-semibold text-muted sm:mt-5 sm:text-lg">
                Perfumería, cuidado de la piel y maquillaje de Natura, con ofertas por debajo del precio de la revista.
              </p>
              {d.hasProducts ? (
                <div className="mt-5 flex flex-wrap gap-2 sm:mt-7 sm:gap-3">
                  <LinkButton href="/productos" size="md" className="shadow-lift sm:h-13 sm:px-7 sm:text-base">
                    Ver productos <ArrowRight className="size-5" aria-hidden="true" />
                  </LinkButton>
                  {hasOffers ? (
                    <LinkButton href="/productos?ofertas=1" size="md" variant="outline" className="bg-white/70 max-md:hidden sm:h-13 sm:px-7 sm:text-base">
                      Ver ofertas
                    </LinkButton>
                  ) : null}
                </div>
              ) : null}
              <ul aria-label="Por qué comprar acá" className="mt-5 grid max-w-lg grid-cols-1 gap-x-3 gap-y-1.5 text-xs font-bold text-forest sm:mt-6 sm:gap-x-5 sm:gap-y-2 sm:text-sm">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-center gap-2">
                    <CircleCheck className="size-4 shrink-0 text-botanical-deep sm:size-[1.1rem]" aria-hidden="true" />
                    {perk}
                  </li>
                ))}
              </ul>
            </div>

            {a ? (
              <div className="relative mx-auto aspect-[1.1] w-full max-w-[250px] sm:max-w-md md:max-w-none" aria-label="Algunos de nuestros productos">
                <HeroProduct product={a} className="top-[4%] left-[20%] z-10 w-[56%] -rotate-3" />
                {b ? <HeroProduct product={b} badgeLeft className="top-[40%] left-0 w-[40%] rotate-[-8deg]" /> : null}
                {c ? <HeroProduct product={c} className="top-[46%] right-0 w-[40%] rotate-[7deg]" /> : null}
              </div>
            ) : (
              <HeroArt className="mx-auto w-full max-w-[220px] sm:max-w-md md:max-w-none" />
            )}
          </div>
        </div>
      </section>

      {/* Cartel que se desliza, en el celular */}
      {d.hasProducts ? (
        <section className="px-4 pt-4 md:hidden" aria-label="Novedades">
          <HomeBanner slides={slides} />
        </section>
      ) : null}

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
            <div className="relative mx-auto grid max-w-7xl gap-5 overflow-hidden rounded-[2rem] bg-gradient-to-br from-blush via-lilac to-peach p-5 sm:gap-8 sm:p-8 md:grid-cols-[1.2fr_1fr] md:items-center">
              <span aria-hidden="true" className="pointer-events-none absolute -right-16 -bottom-20 size-64 rounded-full bg-white/60 blur-3xl" />
              <div className="relative">
                <ClubPitch>
                <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-coral-deep sm:text-sm">
                  <span className="relative inline-flex">
                    <span aria-hidden="true" className="animate-ping-soft absolute inset-0 rounded-full bg-coral-deep/40" />
                    <Gift className="relative size-4" aria-hidden="true" />
                  </span>{" "}
                  Club Natu Mariel · Es gratis
                </p>
                <h2 id="club" className="mt-2 font-display text-2xl leading-tight font-bold sm:mt-3 sm:text-4xl">
                  Creá tu cuenta y <span className="text-coral-deep">ganá regalos</span>
                </h2>
                <p className="mt-2 max-w-lg text-sm font-semibold text-forest/85 sm:text-base">
                  Entrás con Google en un toque, sin contraseña. Cada {GIFT_EVERY} compras{d.clubMinCents > 0 ? ` de ${formatARS(d.clubMinCents)} o más` : ""}, Mariel te regala algo especial.
                </p>
                <ul className="mt-3 flex max-w-lg flex-col gap-1.5 text-sm font-bold sm:text-base">
                  {[
                    "Cada compra pagada y confirmada suma un sello",
                    "Los pedidos que hagas con tu cuenta quedan juntos para seguirlos",
                  ].map((t) => (
                    <li key={t} className="flex items-start gap-2">
                      <CircleCheck className="mt-0.5 size-5 shrink-0 text-botanical-deep" aria-hidden="true" />
                      {t}
                    </li>
                  ))}
                </ul>
                </ClubPitch>
              </div>
              <ClubProgressCard minCents={d.clubMinCents} />
            </div>
          </section>

          {stars.length > 0 ? <StarProducts products={stars} /> : null}

          {hasOffers ? (
            <Section>
              <SectionHeader title="Ofertas para vos 🔥" subtitle="Productos con descuento sobre el precio de revista" href="/productos?ofertas=1" />
              <ProductRail products={d.offers.slice(0, 8)} />
            </Section>
          ) : null}

          {d.bestSellers.length >= 4 ? (
            <Section>
              <SectionHeader title="Los más vendidos 🏆" subtitle="Lo que más se llevan nuestras clientas" href="/productos" />
              <ProductRail products={d.bestSellers.slice(0, 8)} />
            </Section>
          ) : null}

          <Section>
            <SectionHeader title="Comprar es fácil" href="/como-comprar" linkLabel="Cómo comprar" />
            <ol className="grid gap-2.5 sm:grid-cols-3">
              {BUY_STEPS.map((step, i) => (
                <li key={step} className="flex items-center gap-3 rounded-2xl bg-warm-white p-3.5 text-sm font-bold shadow-soft ring-1 ring-line/60 sm:text-base">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-lilac font-display text-grape tabular">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </Section>

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

          {d.latest.length > 0 ? (
            <Section>
              <SectionHeader title="Recién agregados ✨" subtitle="Lo último que sumamos a la tienda" href="/productos?orden=nuevos" />
              <ProductRail products={d.latest.slice(0, 8)} />
            </Section>
          ) : null}

          {/* Al final: para quien bajó todo sin encontrar nada, el catálogo completo. */}
          {d.more.length > 0 ? (
            <Section className="pb-14">
              <SectionHeader
                title="Todos los productos 🛍️"
                subtitle="Mirá el catálogo completo"
                href="/productos"
              />
              <ProductRail products={d.more} />
              <div className="mt-6 flex justify-center">
                <LinkButton href="/productos" size="lg" className="w-full shadow-lift sm:w-auto">
                  Ver todos los productos <ArrowRight className="size-5" aria-hidden="true" />
                </LinkButton>
              </div>
            </Section>
          ) : null}
        </>
      )}
    </>
  );
}
