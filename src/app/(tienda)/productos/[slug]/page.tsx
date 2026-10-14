import { ChevronRight, MessageCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonClasses } from "@/components/ui/button";
import { AddToCart } from "@/components/store/add-to-cart";
import { Gallery } from "@/components/store/gallery";
import { DiscountBadge, Price } from "@/components/store/price";
import { ProductGrid } from "@/components/store/product-card";
import { StockBadge } from "@/components/store/stock-badge";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { getSiteUrl, SITE_NAME } from "@/lib/config";
import { productImageUrl } from "@/lib/images";
import { slugify } from "@/lib/slug";
import { toCents } from "@/lib/pricing";
import { buildProductInquiryMessage, buildWhatsAppUrl, getWhatsAppNumber } from "@/lib/whatsapp";

export const revalidate = 300;

export async function generateMetadata({ params }: PageProps<"/productos/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Producto no encontrado", robots: { index: false } };
  const description =
    product.description.slice(0, 155) || `${product.name} a precio especial en ${SITE_NAME}.`;
  const image = product.images[0] ? productImageUrl(product.images[0].storage_path) : null;
  return {
    title: product.name,
    description,
    alternates: { canonical: `/productos/${product.slug}` },
    openGraph: {
      title: product.name,
      description,
      url: `/productos/${product.slug}`,
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps<"/productos/[slug]">) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product);
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/productos/${product.slug}`;
  const images = product.images
    .map((img) => ({ id: img.id, url: productImageUrl(img.storage_path), alt: img.alt }))
    .filter((img): img is { id: string; url: string; alt: string | null } => Boolean(img.url));
  const whatsapp = getWhatsAppNumber();

  // Datos estructurados solo con información real del producto publicado.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description || undefined,
    image: images.length ? images.map((i) => i.url) : undefined,
    url,
    category: product.category?.name,
    offers: {
      "@type": "Offer",
      price: (toCents(product.sale_price) / 100).toFixed(2),
      priceCurrency: "ARS",
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
    },
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <nav aria-label="Ruta de navegación" className="mb-6 text-sm text-muted">
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/" className="hover:text-forest">Inicio</Link>
          </li>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <li>
            <Link href="/productos" className="hover:text-forest">Productos</Link>
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

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        <div className="relative">
          <Gallery images={images} name={product.name} />
          <DiscountBadge
            magazinePrice={product.magazine_price}
            salePrice={product.sale_price}
            size="lg"
            className="absolute -top-4 -right-2 z-10 sm:-right-4"
          />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {product.category ? (
                <span className="rounded-full bg-lilac px-3 py-1 text-xs font-extrabold tracking-[0.1em] text-grape uppercase">
                  {product.category.name}
                </span>
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
                <span className="rounded-full bg-cream px-3 py-1 text-xs font-extrabold tracking-[0.1em] text-forest uppercase">
                  Repuesto
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 font-display text-4xl leading-tight font-bold sm:text-5xl">{product.name}</h1>
            {product.size ? <p className="mt-1 text-muted">{product.size}</p> : null}
          </div>

          <div className="rounded-3xl border-2 border-forest bg-warm-white p-5 shadow-[4px_4px_0_var(--forest)]">
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

          {whatsapp ? (
            <a
              href={buildWhatsAppUrl(whatsapp, buildProductInquiryMessage(product.name, url))}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonClasses("outline", "lg")}
            >
              <MessageCircle className="size-5" aria-hidden="true" />
              Consultar por WhatsApp
            </a>
          ) : (
            <p className="text-sm text-muted">
              Las consultas por WhatsApp van a estar disponibles muy pronto.
            </p>
          )}

          {product.description ? (
            <section aria-labelledby="desc" className="border-t border-line pt-5">
              <h2 id="desc" className="font-display text-xl font-bold">Descripción</h2>
              <div className="mt-2 leading-relaxed whitespace-pre-line text-forest/90">{product.description}</div>
            </section>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-16" aria-labelledby="rel">
          <h2 id="rel" className="mb-6 font-display text-2xl font-bold">También te puede gustar</h2>
          <ProductGrid products={related} />
        </section>
      ) : null}
    </div>
  );
}
