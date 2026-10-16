import Image from "next/image";
import Link from "next/link";

import type { PublicProduct } from "@/lib/catalog";
import { productImageUrl } from "@/lib/images";
import { LeafMark } from "./logo";
import { getPriceInfo } from "@/lib/pricing";
import { Price } from "./price";
import { StockBadge } from "./stock-badge";

const CARD_TINTS = ["bg-pink", "bg-sun", "bg-sage", "bg-lilac", "bg-peach"];

/** Color de fondo estable por producto, para que la grilla se vea variada. */
function tintFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return CARD_TINTS[h % CARD_TINTS.length];
}

export function ProductImageFallback({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-pink via-peach to-sun ${className}`}>
      <LeafMark className="size-14 opacity-80" />
    </div>
  );
}

export function ProductCard({ product }: { product: PublicProduct }) {
  const img = product.images[0];
  const src = img ? productImageUrl(img.storage_path) : null;
  const info = getPriceInfo(product.magazine_price, product.sale_price);
  const soldOut = product.stock <= 0;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-warm-white shadow-soft ring-1 ring-line/80 transition duration-300 hover:-translate-y-1 hover:shadow-lift">
      <div className={`relative aspect-square overflow-hidden ${tintFor(product.id)}`}>
        {src ? (
          <Image
            src={src}
            alt={img?.alt || product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className={`object-cover transition-transform duration-500 group-hover:scale-[1.06] ${soldOut ? "opacity-60 grayscale-[35%]" : ""}`}
          />
        ) : (
          <ProductImageFallback className="size-full" />
        )}
        <div className="absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2">
          {info.hasDiscount && info.discountPercent >= 1 ? (
            <span className="rounded-full bg-coral-deep px-2.5 py-1 font-display text-sm leading-none font-bold text-white shadow-soft tabular">
              −{info.discountPercent}%
            </span>
          ) : (
            <span />
          )}
          {soldOut ? (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-bold text-muted shadow-soft backdrop-blur">Agotado</span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-3.5 sm:p-4">
        {product.category ? (
          <p className="text-[11px] font-extrabold tracking-[0.12em] text-grape uppercase">{product.category.name}</p>
        ) : null}
        <h3 className="line-clamp-2 text-[15px] leading-snug font-bold sm:text-base">
          <Link href={`/productos/${product.slug}`} className="after:absolute after:inset-0 after:rounded-3xl">
            {product.name}
          </Link>
        </h3>
        {product.size ? <p className="text-xs font-semibold text-muted">{product.size}</p> : null}
        <div className="mt-auto flex flex-col gap-1 pt-2">
          <Price magazinePrice={product.magazine_price} salePrice={product.sale_price} />
          {!soldOut ? <StockBadge stock={product.stock} /> : null}
        </div>
      </div>
    </article>
  );
}

export function ProductGrid({ products }: { products: PublicProduct[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.id} className="flex">
          <div className="w-full">
            <ProductCard product={p} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Fila deslizable en el celular (una tarjeta y media a la vista) y grilla en la computadora. */
export function ProductRail({ products }: { products: PublicProduct[] }) {
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.id} className="flex w-[46%] shrink-0 snap-start sm:w-auto">
          <div className="w-full">
            <ProductCard product={p} />
          </div>
        </li>
      ))}
    </ul>
  );
}
