"use client";

import { Plus, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { getCartSuggestions, type CartSuggestion } from "@/app/(tienda)/carrito/actions";
import { cart, useCart } from "@/lib/cart-store";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { toCents } from "@/lib/pricing";
import { ProductImageFallback } from "./product-card";

/** «Otras clientas también llevan»: sugerencias según lo que hay en el carrito. */
export function CartSuggestions() {
  const items = useCart();
  const [list, setList] = useState<CartSuggestion[]>([]);
  const ids = items.map((i) => i.productId).sort().join(",");

  useEffect(() => {
    if (!ids) return;
    let cancelled = false;
    getCartSuggestions(ids.split(","))
      .then((res) => {
        if (!cancelled) setList(res);
      })
      .catch(() => {
        if (!cancelled) setList([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ids]);

  const inCart = new Set(items.map((i) => i.productId));
  const shown = list.filter((s) => !inCart.has(s.productId));
  if (shown.length === 0) return null;

  return (
    <section aria-labelledby="suggestions-title" className="mt-6">
      <h2 id="suggestions-title" className="flex items-center gap-2 font-display text-xl font-bold">
        <Sparkles className="size-5 text-coral-deep" aria-hidden="true" />
        {shown.some((s) => s.together) ? "Otras clientas también llevan" : "Te puede gustar"}
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {shown.map((s) => {
          const src = s.image ? productImageUrl(s.image) : null;
          const unit = toCents(s.salePrice);
          return (
            <li key={s.productId} className="flex flex-col overflow-hidden rounded-3xl border border-line/70 bg-warm-white shadow-soft">
              <Link href={`/productos/${s.slug}`} className="relative aspect-square bg-white" aria-label={s.name}>
                {src ? <Image src={src} alt="" fill sizes="(min-width: 640px) 160px, 45vw" className="object-cover" /> : <ProductImageFallback className="size-full" />}
              </Link>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <Link href={`/productos/${s.slug}`} className="line-clamp-2 text-sm leading-snug font-bold hover:text-coral-deep">
                  {s.name}
                </Link>
                <p className="text-sm font-bold tabular">{formatARS(unit)}</p>
                <button
                  type="button"
                  onClick={() => {
                    cart.add({ productId: s.productId, slug: s.slug, name: s.name, size: s.size, image: s.image, salePrice: s.salePrice, magazinePrice: s.magazinePrice, stock: s.stock }, 1);
                    toast.success("Agregado a tu carrito", { position: "bottom-center", duration: 2000 });
                  }}
                  className="mt-auto inline-flex h-10 items-center justify-center gap-1 rounded-full bg-forest text-sm font-bold text-white hover:bg-forest/90"
                >
                  <Plus className="size-4" aria-hidden="true" /> Agregar
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
