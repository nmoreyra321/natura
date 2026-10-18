import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductView } from "@/components/store/product-view";
import { getProductBySlug, getRelatedProducts } from "@/lib/catalog";
import { getSiteUrl, SITE_NAME } from "@/lib/config";
import { productImageUrl } from "@/lib/images";
import { toCents } from "@/lib/pricing";
import { getWhatsAppNumber } from "@/lib/whatsapp";

export const revalidate = 300;

/** Sin fichas armadas de antemano: cada una se arma en la primera visita y queda guardada (así abren al instante). */
export function generateStaticParams() {
  return [];
}

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

  return <ProductView product={product} related={related} images={images} url={url} whatsapp={whatsapp} jsonLd={jsonLd} />;
}
