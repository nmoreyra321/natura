"use client";

import { AlertCircle, Info, Loader2, MessageCircle, ShoppingBag, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { validateCart } from "@/app/(tienda)/carrito/actions";
import { Button, LinkButton, buttonClasses } from "@/components/ui/button";
import { cart, useCart, useCartHydrated } from "@/lib/cart-store";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { toCents } from "@/lib/pricing";
import { buildOrderMessage, buildWhatsAppUrl, getOrderTotals, type OrderLine } from "@/lib/whatsapp";
import { QuantityInput } from "./add-to-cart";
import { ProductImageFallback } from "./product-card";

type Status = "idle" | "checking" | "ok" | "error";

export function CartView({ whatsappNumber, siteUrl }: { whatsappNumber: string | null; siteUrl: string }) {
  const items = useCart();
  const hydrated = useCartHydrated();
  const [status, setStatus] = useState<Status>("idle");
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  // Clave estable: cambia solo si cambian productos o cantidades.
  const key = items.map((i) => `${i.productId}:${i.quantity}`).join("|");

  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      setStatus("checking");
      const snapshot = cart;
      const current = items;
      const res = await validateCart(current.map((i) => ({ productId: i.productId, quantity: i.quantity })));
      if (id !== requestId.current) return;
      if (!res.ok) {
        setStatus("error");
        setError(res.error);
        return;
      }
      const messages: string[] = [];
      const updates = new Map(
        res.products.map((p) => [
          p.productId,
          {
            name: p.name,
            slug: p.slug,
            size: p.size,
            image: p.image,
            salePrice: p.salePrice,
            magazinePrice: p.magazinePrice,
            stock: p.stock,
          },
        ]),
      );
      for (const item of current) {
        const u = updates.get(item.productId);
        if (!u) {
          messages.push(`“${item.name}” ya no está disponible y lo quitamos del carrito.`);
          continue;
        }
        if (u.stock <= 0) messages.push(`“${u.name}” se quedó sin stock y lo quitamos del carrito.`);
        else if (item.quantity > u.stock) messages.push(`De “${u.name}” quedan ${u.stock}: ajustamos la cantidad.`);
        if (toCents(u.salePrice) !== toCents(item.salePrice))
          messages.push(`El precio de “${u.name}” se actualizó a ${formatARS(toCents(u.salePrice))}.`);
      }
      snapshot.sync(updates, new Set(res.missing));
      setNotices((prev) => (messages.length ? messages : prev));
      setError(null);
      setStatus("ok");
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, hydrated]);

  const lines: OrderLine[] = useMemo(
    () =>
      items.map((i) => ({
        name: i.name,
        size: i.size,
        quantity: i.quantity,
        unitCents: toCents(i.salePrice),
        magazineUnitCents: toCents(i.magazinePrice),
      })),
    [items],
  );
  const totals = getOrderTotals(lines);

  if (!hydrated) {
    return (
      <div className="flex justify-center py-24 text-muted" role="status">
        <Loader2 className="size-6 animate-spin" aria-hidden="true" />
        <span className="sr-only">Cargando carrito…</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-blush">
          <ShoppingBag className="size-9 text-coral-deep" aria-hidden="true" />
        </div>
        <h2 className="mt-6 font-display text-2xl font-bold">Tu carrito está vacío</h2>
        <p className="mt-2 text-muted">Cuando agregues productos, los vas a ver acá.</p>
        {notices.length > 0 ? (
          <ul className="mt-4 text-sm text-muted">
            {notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}
        <LinkButton href="/productos" size="lg" className="mt-8">
          Ver productos
        </LinkButton>
      </div>
    );
  }

  const ready = status === "ok" && Boolean(whatsappNumber);
  const whatsappUrl = ready && whatsappNumber ? buildWhatsAppUrl(whatsappNumber, buildOrderMessage(lines, siteUrl)) : null;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <section aria-labelledby="items-title">
        <h2 id="items-title" className="sr-only">
          Productos en tu carrito
        </h2>
        {notices.length > 0 ? (
          <div className="mb-4 rounded-2xl border border-coral/40 bg-coral-soft p-4" role="status">
            <p className="flex items-center gap-2 font-semibold">
              <Info className="size-5 text-coral-deep" aria-hidden="true" />
              Actualizamos tu carrito
            </p>
            <ul className="mt-1 list-disc pl-9 text-sm">
              {notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <ul className="flex flex-col gap-3">
          {items.map((item) => {
            const src = item.image ? productImageUrl(item.image) : null;
            const unit = toCents(item.salePrice);
            const mag = toCents(item.magazinePrice);
            return (
              <li key={item.productId} className="flex gap-4 rounded-3xl border border-line/70 bg-warm-white p-3 shadow-soft sm:p-4">
                <Link href={`/productos/${item.slug}`} className="relative size-22 shrink-0 overflow-hidden rounded-2xl bg-white sm:size-28" tabIndex={-1} aria-hidden="true">
                  {src ? <Image src={src} alt="" fill sizes="112px" className="object-cover" /> : <ProductImageFallback className="size-full" />}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/productos/${item.slug}`} className="font-display text-lg leading-snug font-bold hover:text-coral-deep">
                        {item.name}
                      </Link>
                      {item.size ? <p className="text-sm text-muted">{item.size}</p> : null}
                      <p className="mt-0.5 text-sm tabular">
                        <span className="font-bold">{formatARS(unit)}</span>
                        {mag > unit ? <span className="ml-2 text-muted line-through">{formatARS(mag)}</span> : null}
                        <span className="text-muted"> c/u</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => cart.remove(item.productId)}
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-muted hover:bg-coral-soft hover:text-coral-deep"
                      aria-label={`Quitar ${item.name} del carrito`}
                    >
                      <Trash2 className="size-5" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    <QuantityInput
                      id={`q-${item.productId}`}
                      label={`Cantidad de ${item.name}`}
                      value={item.quantity}
                      max={item.stock}
                      onChange={(n) => cart.setQuantity(item.productId, n)}
                    />
                    <p className="font-bold tabular">
                      <span className="sr-only">Subtotal: </span>
                      {formatARS(unit * item.quantity)}
                    </p>
                  </div>
                  {item.quantity >= item.stock ? (
                    <p className="text-xs text-muted">Máximo disponible: {item.stock}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <aside aria-labelledby="summary-title" className="h-fit rounded-3xl bg-warm-white p-5 shadow-lift lg:sticky lg:top-24">
        <h2 id="summary-title" className="font-display text-2xl font-bold">Resumen</h2>
        <dl className="mt-4 flex flex-col gap-2 tabular">
          <div className="flex justify-between">
            <dt className="text-muted">Productos</dt>
            <dd>{totals.units}</dd>
          </div>
          {totals.savingsCents > 0 ? (
            <div className="flex justify-between font-semibold text-botanical-deep">
              <dt>Ahorrás frente a revista</dt>
              <dd>{formatARS(totals.savingsCents)}</dd>
            </div>
          ) : null}
          <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
            <dt className="text-lg font-bold">Total</dt>
            <dd className="text-2xl font-extrabold text-coral-deep">{formatARS(totals.totalCents)}</dd>
          </div>
        </dl>

        <div className="mt-5 flex flex-col gap-3">
          {!whatsappNumber ? (
            <>
              <Button variant="whatsapp" size="lg" disabled aria-describedby="wa-off">
                <MessageCircle className="size-5" aria-hidden="true" />
                Hacer pedido por WhatsApp
              </Button>
              <p id="wa-off" className="flex gap-2 rounded-2xl bg-cream p-3 text-sm text-muted">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Estamos terminando de configurar los pedidos por WhatsApp. Tu carrito queda guardado en este
                dispositivo para cuando esté listo.
              </p>
            </>
          ) : whatsappUrl ? (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("whatsapp", "lg")}>
              <MessageCircle className="size-5" aria-hidden="true" />
              Hacer pedido por WhatsApp
            </a>
          ) : (
            <Button variant="whatsapp" size="lg" disabled>
              {status === "error" ? (
                <AlertCircle className="size-5" aria-hidden="true" />
              ) : (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              )}
              {status === "error" ? "No pudimos verificar el carrito" : "Verificando precios y stock…"}
            </Button>
          )}
          {error ? (
            <p className="text-sm font-semibold text-coral-deep" role="alert">
              {error}
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-muted">
            Al enviar el pedido se abre WhatsApp con el detalle. Mariel te va a confirmar stock, forma de pago y
            entrega. El pedido no queda confirmado ni el stock reservado hasta esa confirmación.
          </p>
          <Link href="/productos" className="text-center text-sm font-semibold text-coral-deep hover:underline">
            Seguir comprando
          </Link>
        </div>
      </aside>
    </div>
  );
}
