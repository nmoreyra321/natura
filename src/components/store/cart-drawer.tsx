"use client";

import { ShoppingBag, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { LinkButton } from "@/components/ui/button";
import { cart, cartCount, cartDrawer, useCart, useCartDrawerOpen } from "@/lib/cart-store";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { toCents } from "@/lib/pricing";
import { getOrderTotals } from "@/lib/whatsapp";
import { QuantityInput } from "./add-to-cart";
import { ProductImageFallback } from "./product-card";

/** Panel lateral con el resumen del carrito. Se abre al agregar un producto o desde el ícono del carrito. */
export function CartDrawer() {
  const open = useCartDrawerOpen();
  const items = useCart();
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Cerrar al navegar a otra página.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    if (open) cartDrawer.close();
  }

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const totals = getOrderTotals(
    items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitCents: toCents(i.salePrice),
      magazineUnitCents: toCents(i.magazinePrice),
    })),
  );
  const count = cartCount(items);

  return (
    <dialog
      ref={dialogRef}
      onClose={() => cartDrawer.close()}
      onClick={(e) => {
        // Clic en el fondo oscuro (fuera del panel) cierra.
        if (e.target === dialogRef.current) cartDrawer.close();
      }}
      aria-labelledby="mini-carrito-titulo"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-dvh w-[min(92vw,420px)] max-w-none overflow-hidden bg-warm-white p-0 text-forest shadow-lift backdrop:bg-forest/35 backdrop:backdrop-blur-[2px] animate-slide-in"
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b-2 border-forest px-5 py-4">
          <h2 id="mini-carrito-titulo" className="font-display text-2xl font-bold">
            Tu carrito {count > 0 ? <span className="text-coral-deep tabular">({count})</span> : null}
          </h2>
          <button
            type="button"
            onClick={() => cartDrawer.close()}
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-full hover:bg-forest/5"
            aria-label="Cerrar carrito"
          >
            <X className="size-6" aria-hidden="true" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-blush">
              <ShoppingBag className="size-7 text-coral-deep" aria-hidden="true" />
            </div>
            <p className="font-display text-xl font-bold">Tu carrito está vacío</p>
            <LinkButton href="/productos">Ver productos</LinkButton>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto px-4 py-3">
              {items.map((item) => {
                const src = item.image ? productImageUrl(item.image) : null;
                const unit = toCents(item.salePrice);
                return (
                  <li key={item.productId} className="flex gap-3 border-b border-line/70 py-3 last:border-b-0">
                    <Link
                      href={`/productos/${item.slug}`}
                      className="relative size-18 shrink-0 overflow-hidden rounded-2xl bg-white"
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      {src ? (
                        <Image src={src} alt="" fill sizes="72px" className="object-cover" />
                      ) : (
                        <ProductImageFallback className="size-full" />
                      )}
                    </Link>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          href={`/productos/${item.slug}`}
                          className="line-clamp-2 text-sm leading-snug font-semibold hover:text-coral-deep"
                        >
                          {item.name}
                        </Link>
                        <button
                          type="button"
                          onClick={() => cart.remove(item.productId)}
                          className="-mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-coral-soft hover:text-coral-deep"
                          aria-label={`Quitar ${item.name} del carrito`}
                        >
                          <Trash2 className="size-4.5" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <QuantityInput
                          id={`mini-q-${item.productId}`}
                          label={`Cantidad de ${item.name}`}
                          value={item.quantity}
                          max={item.stock}
                          onChange={(n) => cart.setQuantity(item.productId, n)}
                        />
                        <p className="font-bold tabular">{formatARS(unit * item.quantity)}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="border-t-2 border-forest bg-cream px-5 py-4">
              {totals.savingsCents > 0 ? (
                <p className="flex justify-between text-sm font-semibold text-botanical-deep tabular">
                  <span>Ahorrás frente a revista</span>
                  <span>{formatARS(totals.savingsCents)}</span>
                </p>
              ) : null}
              <p className="mt-1 flex items-baseline justify-between tabular">
                <span className="text-lg font-bold">Total</span>
                <span className="flex items-baseline gap-2">
                  {totals.savingsCents > 0 ? (
                    <span className="text-base font-semibold text-muted line-through" aria-label="Precio de revista">
                      {formatARS(totals.totalCents + totals.savingsCents)}
                    </span>
                  ) : null}
                  <span className="text-2xl font-extrabold text-coral-deep">{formatARS(totals.totalCents)}</span>
                </span>
              </p>
              <LinkButton href="/carrito" size="lg" className="mt-3 w-full">
                Ver carrito y hacer pedido
              </LinkButton>
              <button
                type="button"
                onClick={() => cartDrawer.close()}
                className="mt-2 w-full py-2 text-center text-sm font-semibold text-coral-deep hover:underline"
              >
                Seguir comprando
              </button>
              <p className="text-center text-xs text-muted">Antes de enviar el pedido verificamos precios y stock.</p>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
