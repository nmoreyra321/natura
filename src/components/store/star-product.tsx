import type { PublicProduct } from "@/lib/catalog";
import { productImageUrl } from "@/lib/images";
import { getPriceInfo } from "@/lib/pricing";
import { StarCarousel, type StarItem } from "./star-carousel";

const HOW_MANY = 5;

/** Semana del año (para cambiar los productos de la semana todas las semanas). */
function weekNumber(now = new Date()) {
  const start = Date.UTC(now.getUTCFullYear(), 0, 1);
  return Math.floor((now.getTime() - start) / (7 * 86_400_000));
}

/** Elige hasta 5 productos de la semana entre los que tienen oferta, stock y foto (rotan solos cada semana). */
export function pickStarProducts(candidates: PublicProduct[], now = new Date()): PublicProduct[] {
  const ok = candidates.filter((p) => p.stock > 0 && p.images.length > 0 && getPriceInfo(p.magazine_price, p.sale_price).hasDiscount);
  if (ok.length === 0) return [];
  const count = Math.min(HOW_MANY, ok.length);
  const first = (weekNumber(now) * count) % ok.length;
  return Array.from({ length: count }, (_, i) => ok[(first + i) % ok.length]);
}

/** Productos de la semana: carrusel donde cada uno flota, brilla y baja de precio contando. */
export function StarProducts({ products }: { products: PublicProduct[] }) {
  const items: StarItem[] = products.map((product) => {
    const info = getPriceInfo(product.magazine_price, product.sale_price);
    const img = [...product.images].sort((a, b) => a.position - b.position)[0];
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      src: img ? productImageUrl(img.storage_path) : null,
      magazineCents: info.magazineCents,
      saleCents: info.saleCents,
      discountPercent: info.discountPercent,
    };
  });
  if (items.length === 0) return null;
  return <StarCarousel items={items} />;
}
