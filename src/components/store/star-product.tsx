import Image from "next/image";
import Link from "next/link";

import type { PublicProduct } from "@/lib/catalog";
import { productImageUrl } from "@/lib/images";
import { getPriceInfo } from "@/lib/pricing";
import { CountPrice } from "./count-price";

/** Semana del año (para cambiar de producto estrella todas las semanas). */
function weekNumber(now = new Date()) {
  const start = Date.UTC(now.getUTCFullYear(), 0, 1);
  return Math.floor((now.getTime() - start) / (7 * 86_400_000));
}

/** Elige el producto de la semana entre los que tienen oferta, stock y foto (cambia solo cada semana). */
export function pickStarProduct(candidates: PublicProduct[], now = new Date()): PublicProduct | null {
  const ok = candidates.filter((p) => p.stock > 0 && p.images.length > 0 && getPriceInfo(p.magazine_price, p.sale_price).hasDiscount);
  if (ok.length === 0) return null;
  return ok[weekNumber(now) % ok.length];
}

/** Producto de la semana: flota, brilla y el precio baja contando hasta el de Natu Mariel. */
export function StarProduct({ product }: { product: PublicProduct }) {
  const info = getPriceInfo(product.magazine_price, product.sale_price);
  const img = [...product.images].sort((a, b) => a.position - b.position)[0];
  const src = img ? productImageUrl(img.storage_path) : null;
  return (
    <section className="px-3 py-4 sm:px-6" aria-label="Producto de la semana">
      <Link
        href={`/productos/${product.slug}`}
        className="star-card relative mx-auto grid max-w-7xl items-center gap-4 overflow-hidden rounded-[2rem] bg-gradient-to-br from-blush via-lilac to-peach p-5 shadow-lift sm:grid-cols-[1fr_1.2fr] sm:gap-8 sm:p-8"
      >
        <span className="absolute top-4 left-4 z-10 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-extrabold text-coral-deep shadow-soft sm:text-sm">
          ⭐ Producto de la semana
        </span>
        <div className="star-float relative mx-auto mt-8 aspect-square w-48 sm:mt-0 sm:w-64">
          {src ? (
            <Image src={src} alt={product.name} fill sizes="(min-width: 640px) 256px, 192px" className="object-contain drop-shadow-[0_14px_10px_rgba(80,20,80,0.25)]" />
          ) : null}
        </div>
        <div className="text-center sm:text-left">
          <h2 className="font-display text-2xl leading-tight font-bold sm:text-4xl">{product.name}</h2>
          <p className="mt-2 text-lg text-forest/70 line-through tabular">{`$ ${Math.round(info.magazineCents / 100).toLocaleString("es-AR")}`}</p>
          <p className="font-display text-4xl font-bold text-coral-deep sm:text-5xl">
            <CountPrice fromCents={info.magazineCents} toCents={info.saleCents} />
          </p>
          <p className="mt-1 font-bold text-botanical-deep">−{info.discountPercent}% que en la revista</p>
          <span className="mt-4 inline-flex min-h-12 items-center rounded-full bg-coral-deep px-6 text-base font-extrabold text-white shadow-soft">Lo quiero</span>
        </div>
      </Link>
    </section>
  );
}
