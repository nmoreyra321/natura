import Image from "next/image";
import Link from "next/link";

import type { PublicProduct } from "@/lib/catalog";
import { productImageUrl } from "@/lib/images";
import { LeafMark } from "./logo";
import { DiscountBadge, Price } from "./price";
import { StockBadge } from "./stock-badge";

export function ProductImageFallback({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center bg-gradient-to-br from-blush to-sage ${className}`}>
      <LeafMark className="size-14 text-botanical/60" />
    </div>
  );
}

export function ProductCard({ product }: { product: PublicProduct }) {
  const img = product.images[0];
  const src = img ? productImageUrl(img.storage_path) : null;
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-line/70 bg-warm-white shadow-soft transition-shadow hover:shadow-lift">
      <div className="relative aspect-square overflow-hidden bg-white">
        {src ? (
          <Image
            src={src}
            alt={img?.alt || product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <ProductImageFallback className="size-full" />
        )}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1.5">
          <DiscountBadge magazinePrice={product.magazine_price} salePrice={product.sale_price} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {product.category ? (
          <p className="text-xs font-bold tracking-[0.12em] text-botanical-deep uppercase">{product.category.name}</p>
        ) : null}
        <h3 className="font-display text-lg leading-snug font-semibold">
          <Link href={`/productos/${product.slug}`} className="after:absolute after:inset-0">
            {product.name}
          </Link>
        </h3>
        {product.size ? <p className="text-sm text-muted">{product.size}</p> : null}
        <div className="mt-auto flex flex-col gap-1.5 pt-2">
          <Price magazinePrice={product.magazine_price} salePrice={product.sale_price} />
          <StockBadge stock={product.stock} />
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
