"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { validateCart } from "@/app/(tienda)/carrito/actions";
import { buttonClasses } from "@/components/ui/button";
import { cart, cartDrawer } from "@/lib/cart-store";

/** «Volver a comprar»: pone en el carrito lo mismo que este pedido (con precios y stock de hoy). */
export function BuyAgain({ items }: { items: { productId: string; quantity: number }[] }) {
  const [loading, setLoading] = useState(false);
  if (items.length === 0) return null;

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        const res = await validateCart(items).catch(() => null);
        setLoading(false);
        if (!res?.ok) {
          toast.error(res?.error ?? "No pudimos armar el carrito. Probá de nuevo.");
          return;
        }
        const byId = new Map(res.products.map((p) => [p.productId, p]));
        let added = 0;
        const missing: string[] = [];
        for (const it of items) {
          const p = byId.get(it.productId);
          if (!p || p.stock <= 0) {
            if (p) missing.push(p.name);
            continue;
          }
          cart.add(p, Math.min(it.quantity, p.stock));
          added++;
        }
        if (added === 0) {
          toast.error("Por ahora no hay stock de estos productos. Podés pedir que te avisen cuando vuelvan.");
          return;
        }
        if (missing.length > 0 || res.missing.length > 0) {
          toast.warning(`Agregamos lo que hay. Sin stock por ahora: ${missing.join(", ") || "algunos productos"}.`);
        } else {
          toast.success("¡Listo! Pusimos lo mismo en tu carrito.");
        }
        cartDrawer.open();
      }}
      className={buttonClasses("outline", "md")}
    >
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
      Volver a comprar lo mismo
    </button>
  );
}
