import { ChevronRight, MessageCircle, Truck, Wallet } from "lucide-react";
import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";
import type { PublicProduct } from "@/lib/catalog";
import { formatARS } from "@/lib/format";
import { getPriceInfo, toCents } from "@/lib/pricing";
import { slugify } from "@/lib/slug";
import { buildProductInquiryMessage, buildWhatsAppUrl } from "@/lib/whatsapp";
import { AddToCart, MobileBuyBar } from "./add-to-cart";
import { Gallery } from "./gallery";
import { Price } from "./price";
import { ProductRail } from "./product-card";
import { RestockForm } from "./restock-form";
import { ShareButton } from "./share-button";
import { StockBadge } from "./stock-badge";

/** Página de un producto (la parte visual; los datos los arma la página). */
export function ProductView({
  product,
  related,
  images,
  url,
  whatsapp,
  jsonLd,
}: {
  product: PublicProduct;
  related: PublicProduct[];
  images: { id: string; url: string; alt: string | null }[];
  url: string;
  whatsapp: string | null;
  jsonLd: object;
}) {
  return (
    <div className="mx-auto max-w-7xl px-4 pt-5 pb-28 sm:px-6 sm:pt-8 md:pb-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav aria-label="Ruta de navegación" className="mb-5 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-forest">Inicio</Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li>
            <Link href="/productos" className="hover:text-forest">Todos los productos</Link>
          </li>
          {product.category ? (
            <>
              <ChevronRight className="size-3.5" aria-hidden="true" />
              <li>
                <Link href={`/categorias/${product.category.slug}`} className="hover:text-forest">
                  {product.category.name}
                </Link>
              </li>
            </>
          ) : null}
        </ol>
      </nav>

      <div className="grid gap-6 md:grid-cols-2 md:gap-10 lg:gap-14">
        <div className="relative md:sticky md:top-24 md:self-start">
          <Gallery images={images} name={product.name} />
          {getPriceInfo(product.magazine_price, product.sale_price).hasDiscount ? (
            <span className="absolute top-3 left-3 z-10 rounded-full bg-coral-deep px-3.5 py-1.5 font-display text-lg leading-none font-bold text-white shadow-lift tabular">
              −{getPriceInfo(product.magazine_price, product.sale_price).discountPercent}%
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {product.category ? (
                <Link
                  href={`/categorias/${product.category.slug}`}
                  className="rounded-full bg-lilac px-3 py-1 text-xs font-extrabold tracking-[0.1em] text-grape uppercase hover:bg-pink"
                >
                  {product.category.name}
                </Link>
              ) : null}
              {product.line ? (
                <Link
                  href={`/productos?linea=${slugify(product.line)}`}
                  className="rounded-full bg-sage px-3 py-1 text-xs font-extrabold tracking-[0.1em] text-botanical-deep uppercase hover:bg-sun"
                >
                  Línea {product.line}
                </Link>
              ) : null}
              {product.is_refill ? (
                <span className="rounded-full bg-cream px-3 py-1 text-xs font-extrabold tracking-[0.1em] text-forest uppercase ring-1 ring-line">
                  Repuesto
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 font-display text-3xl leading-tight font-bold sm:text-[2.6rem]">{product.name}</h1>
            {product.size ? <p className="mt-1 font-semibold text-muted">{product.size}</p> : null}
          </div>

          <div id="comprar" className="flex scroll-mt-28 flex-col gap-4 rounded-[1.75rem] bg-warm-white p-5 shadow-soft ring-1 ring-line/80">
            <div className="rounded-2xl bg-gradient-to-br from-blush to-lilac/70 p-4">
              <Price magazinePrice={product.magazine_price} salePrice={product.sale_price} size="lg" showSavings />
              <StockBadge stock={product.stock} className="mt-3" />
            </div>
            <AddToCart
              product={{
                productId: product.id,
                slug: product.slug,
                name: product.name,
                size: product.size,
                image: product.images[0]?.storage_path ?? null,
                salePrice: toCents(product.sale_price) / 100,
                magazinePrice: toCents(product.magazine_price) / 100,
                stock: product.stock,
              }}
            />
            {product.stock <= 0 ? <RestockForm productId={product.id} /> : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {whatsapp ? (
                <a
                  href={buildWhatsAppUrl(whatsapp, buildProductInquiryMessage(product.name, url))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses("outline", "lg", "w-full")}
                >
                  <MessageCircle className="size-5" aria-hidden="true" />
                  Consultar
                </a>
              ) : null}
              <ShareButton
                title={product.name}
                text={`Mirá este producto de Natu Mariel: ${product.name}${product.size ? ` (${product.size})` : ""} a ${formatARS(toCents(product.sale_price))}`}
                url={url}
              />
            </div>
          </div>

          <ul className="grid gap-2 text-sm sm:grid-cols-3" aria-label="Cómo comprás">
            {[
              { icon: MessageCircle, text: "Pedís por WhatsApp, sin registrarte", tone: "bg-sage text-botanical-deep" },
              { icon: Wallet, text: "Pagás en efectivo o transferencia", tone: "bg-sun text-forest" },
              { icon: Truck, text: "Coordinás la entrega con Mariel", tone: "bg-pink text-coral-deep" },
            ].map((p) => (
              <li key={p.text} className="flex items-center gap-2.5 rounded-2xl bg-warm-white p-2.5 font-semibold ring-1 ring-line/70">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${p.tone}`}>
                  <p.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="leading-tight">{p.text}</span>
              </li>
            ))}
          </ul>

          {product.description ? (
            <section aria-labelledby="desc" className="rounded-[1.75rem] bg-warm-white p-5 ring-1 ring-line/80">
              <h2 id="desc" className="font-display text-xl font-bold">
                Sobre este producto
              </h2>
              <div className="mt-2 leading-relaxed whitespace-pre-line text-forest/90">{product.description}</div>
            </section>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-14" aria-labelledby="rel">
          <h2 id="rel" className="mb-5 font-display text-2xl font-bold sm:text-3xl">
            También te puede gustar
          </h2>
          <ProductRail products={related} />
        </section>
      ) : null}

      <MobileBuyBar
        product={{
          productId: product.id,
          slug: product.slug,
          name: product.name,
          size: product.size,
          image: product.images[0]?.storage_path ?? null,
          salePrice: toCents(product.sale_price) / 100,
          magazinePrice: toCents(product.magazine_price) / 100,
          stock: product.stock,
        }}
      />
    </div>
  );
}
