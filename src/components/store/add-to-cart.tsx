"use client";

import { Minus, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cart, useCart, type CartItem } from "@/lib/cart-store";

export function QuantityInput({
  value,
  max,
  onChange,
  label,
  id,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
  id: string;
}) {
  const clamp = (n: number) => Math.min(Math.max(Number.isFinite(n) ? Math.floor(n) : 1, 1), Math.max(max, 1));
  return (
    <div className="inline-flex h-11 items-center rounded-full border border-line bg-white">
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-full hover:bg-forest/5 disabled:opacity-40"
        onClick={() => onChange(clamp(value - 1))}
        disabled={value <= 1}
        aria-label="Restar una unidad"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={max}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="h-full w-12 bg-transparent text-center font-bold tabular [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
      />
      <button
        type="button"
        className="inline-flex size-11 items-center justify-center rounded-full hover:bg-forest/5 disabled:opacity-40"
        onClick={() => onChange(clamp(value + 1))}
        disabled={value >= max}
        aria-label="Sumar una unidad"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function AddToCart({ product }: { product: Omit<CartItem, "quantity"> }) {
  const router = useRouter();
  const items = useCart();
  const inCart = items.find((i) => i.productId === product.productId)?.quantity ?? 0;
  const available = Math.max(product.stock - inCart, 0);
  const [qty, setQty] = useState(1);

  if (product.stock <= 0) {
    return (
      <p className="rounded-2xl bg-cream px-4 py-3 font-semibold text-muted">
        Este producto no tiene stock por ahora. Podés consultar por WhatsApp cuándo vuelve.
      </p>
    );
  }

  const quantity = Math.min(qty, Math.max(available, 1));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <QuantityInput id="cantidad" label="Cantidad" value={quantity} max={Math.max(available, 1)} onChange={setQty} />
        <Button
          size="lg"
          className="min-w-52 flex-1"
          disabled={available <= 0}
          onClick={() => {
            const res = cart.add(product, quantity);
            if (res.capped) {
              toast.warning(`Agregamos el máximo disponible: ${res.quantity} en tu carrito.`);
            } else {
              toast.success("¡Listo! Lo agregamos a tu carrito.", {
                action: { label: "Ver carrito", onClick: () => router.push("/carrito") },
              });
            }
            setQty(1);
          }}
        >
          <ShoppingBag className="size-5" aria-hidden="true" />
          Agregar al carrito
        </Button>
      </div>
      {inCart > 0 ? (
        <p className="text-sm text-muted">
          Ya tenés {inCart} en tu <Link href="/carrito" className="font-semibold text-coral-deep underline">carrito</Link>.
          {available <= 0 ? " Alcanzaste el stock disponible." : ""}
        </p>
      ) : null}
    </div>
  );
}
