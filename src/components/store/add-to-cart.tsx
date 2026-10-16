"use client";

import { Minus, Plus, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cart, cartDrawer, useCart, type CartItem } from "@/lib/cart-store";
import { formatARS } from "@/lib/format";
import { getPriceInfo, toCents } from "@/lib/pricing";

/**
 * Aviso de «agregado»: abajo (arriba taparía el carrito que se sacude con el «+1»),
 * con un botón para abrir el carrito si la clienta quiere.
 */
const ADDED_TOAST = {
  position: "bottom-center" as const,
  duration: 2500,
  action: { label: "Ver carrito", onClick: () => cartDrawer.open() },
};

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

/** Cantidad elegida en la ficha de cada producto, para que el cartel de ahorro la use. */
const selectedQty = new Map<string, number>();
const qtyListeners = new Set<() => void>();
function setSelectedQty(productId: string, n: number) {
  if (selectedQty.get(productId) === n) return;
  selectedQty.set(productId, n);
  qtyListeners.forEach((l) => l());
}
function subscribeQty(l: () => void) {
  qtyListeners.add(l);
  return () => qtyListeners.delete(l);
}

/** Cantidad elegida ahora en la ficha del producto (1 si todavía no se tocó). */
function useSelectedQty(productId: string): number {
  return useSyncExternalStore(
    subscribeQty,
    () => selectedQty.get(productId) ?? 1,
    () => 1,
  );
}

/** Cartel "¡Ahorrás $X!" que se actualiza según la cantidad elegida. */
export function LiveSavings({ productId, magazinePrice, salePrice }: { productId: string; magazinePrice: number; salePrice: number }) {
  const qty = useSelectedQty(productId);
  const info = getPriceInfo(magazinePrice, salePrice);
  if (!info.hasDiscount) return null;
  return (
    <p className="mt-1 inline-flex w-fit flex-wrap items-center gap-x-1.5 rounded-full bg-sun px-3 py-1 text-sm font-extrabold text-forest tabular" aria-live="polite">
      ¡Ahorrás {formatARS(info.savingsCents * qty)}
      {qty > 1 ? ` llevando ${qty}` : ""}!
      {info.discountPercent >= 1 ? <span> {info.discountPercent}% menos que en revista</span> : null}
    </p>
  );
}

export function AddToCart({ product }: { product: Omit<CartItem, "quantity"> }) {
  const items = useCart();
  const inCart = items.find((i) => i.productId === product.productId)?.quantity ?? 0;
  const available = Math.max(product.stock - inCart, 0);
  const [qty, setQty] = useState(1);
  const shownQty = product.stock <= 0 ? 1 : Math.min(qty, Math.max(available, 1));
  useEffect(() => setSelectedQty(product.productId, shownQty), [product.productId, shownQty]);

  if (product.stock <= 0) {
    return (
      <p className="rounded-2xl bg-cream px-4 py-3 font-semibold text-muted">
        Este producto no tiene stock por ahora. Podés consultar por WhatsApp cuándo vuelve.
      </p>
    );
  }

  const quantity = Math.min(qty, Math.max(available, 1));
  const saleCents = toCents(product.salePrice);
  const magazineCents = toCents(product.magazinePrice);
  const unitSavings = magazineCents > saleCents ? magazineCents - saleCents : 0;

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
              // El carrito de arriba se sacude con un «+1»; el panel se abre solo si lo pide.
              toast.success(quantity === 1 ? "¡Agregado al carrito!" : `¡Agregaste ${quantity} al carrito!`, ADDED_TOAST);
            }
            setQty(1);
          }}
        >
          <ShoppingBag className="size-5" aria-hidden="true" />
          Agregar al carrito
        </Button>
      </div>
      {quantity >= 1 ? (
        <p className="rounded-2xl bg-cream px-4 py-2.5 text-sm tabular" aria-live="polite">
          Llevando <strong>{quantity}</strong>: pagás <strong className="whitespace-nowrap text-coral-deep">{formatARS(saleCents * quantity)}</strong>
          {unitSavings > 0 ? (
            <>
              {" "}
              en vez de <span className="whitespace-nowrap line-through">{formatARS(magazineCents * quantity)}</span>.
            </>
          ) : (
            "."
          )}
        </p>
      ) : null}
      {inCart > 0 ? (
        <p className="text-sm text-muted">
          Ya tenés {inCart} en tu <Link href="/carrito" className="font-semibold text-coral-deep underline">carrito</Link>.
          {available <= 0 ? " Alcanzaste el stock disponible." : ""}
        </p>
      ) : null}
    </div>
  );
}
