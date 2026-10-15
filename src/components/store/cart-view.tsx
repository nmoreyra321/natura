"use client";

import { AlertCircle, ArrowLeftRight, Banknote, CreditCard, Info, Loader2, MessageCircle, ShoppingBag, Trash2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { payWithMercadoPago, registerOrder, validateCart } from "@/app/(tienda)/carrito/actions";
import { Button, LinkButton, buttonClasses } from "@/components/ui/button";
import { cart, useCart, useCartHydrated } from "@/lib/cart-store";
import { toWhatsAppPhone } from "@/lib/debts";
import { formatARS } from "@/lib/format";
import { productImageUrl } from "@/lib/images";
import { surchargeCents, toCents } from "@/lib/pricing";
import { buildOrderMessage, buildWhatsAppUrl, getOrderTotals, type OrderLine } from "@/lib/whatsapp";
import type { TransferDetails } from "@/lib/store-settings";
import { QuantityInput } from "./add-to-cart";
import { SavingsCelebration } from "./savings-celebration";
import { ProductImageFallback } from "./product-card";

type Status = "idle" | "checking" | "ok" | "error";
type PaymentChoice = "efectivo" | "transferencia" | "mercadopago";

const NAME_KEY = "natu-mariel:nombre";
const PHONE_KEY = "natu-mariel:telefono";

function readSaved(key: string): string {
  try {
    return typeof window === "undefined" ? "" : (window.localStorage.getItem(key) ?? "");
  } catch {
    return "";
  }
}

function saveContact(name: string, phone: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name);
    window.localStorage.setItem(PHONE_KEY, phone);
  } catch {
    // Sin almacenamiento: no pasa nada.
  }
}


export function CartView({
  whatsappNumber,
  siteUrl,
  mercadoPago = false,
  transfer = null,
  mpSurcharge = 0,
}: {
  whatsappNumber: string | null;
  siteUrl: string;
  /** true si la tienda tiene Mercado Pago configurado. */
  mercadoPago?: boolean;
  /** Datos de la cuenta para transferir (null si no hay alias cargado). */
  transfer?: TransferDetails | null;
  /** % de recargo si paga con Mercado Pago. */
  mpSurcharge?: number;
}) {
  const router = useRouter();
  const items = useCart();
  const hydrated = useCartHydrated();
  const [status, setStatus] = useState<Status>("idle");
  const [notices, setNotices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const [customerName, setCustomerName] = useState(() => readSaved(NAME_KEY));
  const [customerPhone, setCustomerPhone] = useState(() => readSaved(PHONE_KEY));
  /** Se marca al intentar enviar: recién ahí se muestran los avisos de datos faltantes. */
  const [triedSend, setTriedSend] = useState(false);
  const nameError = customerName.trim().length < 2 ? "Escribí tu nombre." : null;
  const phoneError = !customerPhone.trim()
    ? "Escribí tu WhatsApp."
    : !toWhatsAppPhone(customerPhone)
      ? "Revisá el número: con código de área, por ejemplo 11 2345-6789."
      : null;
  /** true si faltan datos: muestra los avisos y lleva al primer casillero a completar. */
  const blockIfMissingContact = (): boolean => {
    if (!nameError && !phoneError) return false;
    setTriedSend(true);
    document.getElementById(nameError ? "nombre-pedido" : "telefono-pedido")?.focus();
    return true;
  };
  const [sending, setSending] = useState(false);
  const [payment, setPayment] = useState<PaymentChoice>("efectivo");
  const paymentOptions: { value: PaymentChoice; label: string; Icon: typeof Banknote }[] = [
    { value: "efectivo", label: "Efectivo", Icon: Banknote },
    ...(transfer ? [{ value: "transferencia" as const, label: "Transferencia", Icon: ArrowLeftRight }] : []),
    ...(mercadoPago
      ? [{ value: "mercadopago" as const, label: mpSurcharge > 0 ? `Mercado Pago (+${mpSurcharge}%)` : "Mercado Pago", Icon: CreditCard }]
      : []),
  ];

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
                    <p className="text-right tabular">
                      <span className="sr-only">Subtotal: </span>
                      <span className="font-bold">{formatARS(unit * item.quantity)}</span>
                      {mag > unit ? (
                        <span className="block text-xs font-semibold text-botanical-deep">
                          Ahorrás {formatARS((mag - unit) * item.quantity)}
                        </span>
                      ) : null}
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
            <div className="my-1">
              <dt className="sr-only">Ahorro frente a revista</dt>
              <dd>
                <SavingsCelebration savingsCents={totals.savingsCents} totalCents={totals.totalCents} />
              </dd>
            </div>
          ) : null}
          <div className="mt-2 flex items-baseline justify-between gap-2 border-t border-line pt-3">
            <dt className="text-lg font-bold">Total</dt>
            <dd className="flex flex-wrap items-baseline justify-end gap-x-2 text-right">
              {totals.savingsCents > 0 ? (
                <span className="text-base font-semibold text-muted line-through tabular" aria-label="Precio de revista">
                  {formatARS(totals.totalCents + totals.savingsCents)}
                </span>
              ) : null}
              <span className="text-2xl font-extrabold text-coral-deep tabular">{formatARS(totals.totalCents)}</span>
            </dd>
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
            <>
              <div>
                <p className="mb-2 text-sm text-muted">
                  Dejanos tu nombre y tu WhatsApp para confirmarte el pedido y avisarte cuando esté listo.
                </p>
                <label htmlFor="nombre-pedido" className="text-sm font-semibold">
                  Nombre y apellido
                </label>
                <input
                  id="nombre-pedido"
                  type="text"
                  autoComplete="name"
                  maxLength={80}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ej.: Laura Gómez"
                  required
                  aria-invalid={triedSend && Boolean(nameError)}
                  aria-describedby={triedSend && nameError ? "nombre-error" : undefined}
                  className={`mt-1 h-11 w-full rounded-full border bg-white px-4 text-base focus:border-botanical focus:ring-3 focus:ring-botanical/20 focus:outline-none ${triedSend && nameError ? "border-coral-deep" : "border-line"}`}
                />
                {triedSend && nameError ? (
                  <p id="nombre-error" className="mt-1 text-sm font-semibold text-coral-deep">
                    {nameError}
                  </p>
                ) : null}
              </div>
              <div>
                <label htmlFor="telefono-pedido" className="text-sm font-semibold">
                  Tu WhatsApp
                </label>
                <input
                  id="telefono-pedido"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={30}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Ej.: 11 2345-6789"
                  required
                  aria-invalid={triedSend && Boolean(phoneError)}
                  aria-describedby={triedSend && phoneError ? "telefono-error" : undefined}
                  className={`mt-1 h-11 w-full rounded-full border bg-white px-4 text-base focus:border-botanical focus:ring-3 focus:ring-botanical/20 focus:outline-none ${triedSend && phoneError ? "border-coral-deep" : "border-line"}`}
                />
                {triedSend && phoneError ? (
                  <p id="telefono-error" className="mt-1 text-sm font-semibold text-coral-deep">
                    {phoneError}
                  </p>
                ) : null}
              </div>
              {paymentOptions.length > 1 ? (
                <fieldset>
                  <legend className="text-sm font-semibold">¿Cómo querés pagar?</legend>
                  <div className={`mt-1.5 grid gap-2 ${paymentOptions.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
                    {paymentOptions.map(({ value, label, Icon }) => (
                      <label
                        key={value}
                        className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 py-2.5 text-center text-sm font-bold transition-colors ${payment === value ? "border-forest bg-sun/60" : "border-line bg-white hover:bg-cream"}`}
                      >
                        <input
                          type="radio"
                          name="forma-de-pago"
                          value={value}
                          checked={payment === value}
                          onChange={() => setPayment(value)}
                          className="sr-only"
                        />
                        <Icon className="size-5" aria-hidden="true" />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}
              {payment === "mercadopago" && mercadoPago && mpSurcharge > 0 ? (
                <p className="rounded-2xl bg-[#e6f6fd] p-3 text-sm text-[#00496f]">
                  Pagando con Mercado Pago se suma un recargo de {mpSurcharge}% (
                  {formatARS(surchargeCents(totals.totalCents, mpSurcharge))}). Total a pagar:{" "}
                  <strong>{formatARS(totals.totalCents + surchargeCents(totals.totalCents, mpSurcharge))}</strong>. En
                  efectivo o transferencia no hay recargo.
                </p>
              ) : null}
              {payment === "transferencia" && transfer ? (
                <p className="flex gap-2 rounded-2xl bg-sage/50 p-3 text-sm">
                  <ArrowLeftRight className="mt-0.5 size-4 shrink-0 text-botanical-deep" aria-hidden="true" />
                  <span>
                    Tocá <strong>Hacer pedido</strong> y en el paso siguiente te mostramos el alias para transferir{" "}
                    <strong>{formatARS(totals.totalCents)}</strong> (sin recargo). Ahí mismo subís el comprobante.
                  </span>
                </p>
              ) : null}
              {payment === "mercadopago" && mercadoPago ? (
                <button
                  type="button"
                  disabled={sending}
                  className="inline-flex h-13 items-center justify-center gap-2 rounded-full bg-[#009ee3] px-7 text-base font-bold text-white transition-colors hover:bg-[#0089c7] disabled:opacity-70"
                  onClick={async () => {
                    if (sending || blockIfMissingContact()) return;
                    setSending(true);
                    setError(null);
                    const name = customerName.trim();
                    const phone = customerPhone.trim();
                    saveContact(name, phone);
                    const res = await payWithMercadoPago({
                      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
                      customerName: name,
                      customerPhone: phone,
                    }).catch(() => null);
                    if (res?.ok) {
                      window.location.href = res.url;
                      return;
                    }
                    setError(res?.error ?? "No pudimos conectar con Mercado Pago. Probá de nuevo.");
                    setSending(false);
                  }}
                >
                  {sending ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <CreditCard className="size-5" aria-hidden="true" />
                  )}
                  {sending ? "Te llevamos a Mercado Pago…" : "Pagar con Mercado Pago"}
                </button>
              ) : payment === "transferencia" && transfer ? (
                <button
                  type="button"
                  disabled={sending}
                  className={buttonClasses("primary", "lg")}
                  onClick={async () => {
                    if (sending || blockIfMissingContact()) return;
                    setSending(true);
                    setError(null);
                    const name = customerName.trim();
                    const phone = customerPhone.trim();
                    saveContact(name, phone);
                    const res = await registerOrder({
                      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
                      customerName: name,
                      customerPhone: phone,
                      paymentMethod: "transferencia",
                    }).catch(() => null);
                    if (res?.ok) {
                      // En la página del pedido avisa el pago y sube el comprobante.
                      router.push(`/pedido/${res.id}?nuevo=1`);
                      return;
                    }
                    setError(res?.error ?? "No pudimos registrar el pedido. Probá de nuevo.");
                    setSending(false);
                  }}
                >
                  {sending ? (
                    <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                  ) : (
                    <ShoppingBag className="size-5" aria-hidden="true" />
                  )}
                  {sending ? "Registrando tu pedido…" : "Hacer pedido"}
                </button>
              ) : (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={sending}
                className={buttonClasses("whatsapp", "lg", sending ? "pointer-events-none opacity-70" : "")}
                onClick={async (e) => {
                  if (!whatsappNumber || sending) return;
                  e.preventDefault();
                  if (blockIfMissingContact()) return;
                  // La pestaña se abre ya (durante el clic) para que el navegador no la bloquee.
                  const win = window.open("", "_blank");
                  setSending(true);
                  const name = customerName.trim();
                  const phone = customerPhone.trim();
                  saveContact(name, phone);
                  const res = await registerOrder({
                    items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
                    customerName: name,
                    customerPhone: phone,
                    paymentMethod: "efectivo",
                  }).catch(() => null);
                  const message = buildOrderMessage(lines, siteUrl, {
                    orderCode: res?.ok ? res.code : null,
                    customerName: name,
                    paymentMethod: paymentOptions.length > 1 ? "efectivo" : undefined,
                    trackUrl: res?.ok ? `${siteUrl}/pedido/${res.id}` : null,
                  });
                  const url = buildWhatsAppUrl(whatsappNumber, message);
                  if (win) {
                    win.opener = null;
                    win.location.href = url;
                    // Esta pestaña pasa a la página del pedido, donde puede ver en qué está.
                    if (res?.ok) {
                      router.push(`/pedido/${res.id}?nuevo=1`);
                      return;
                    }
                  } else {
                    window.location.href = url;
                  }
                  setSending(false);
                }}
              >
                {sending ? (
                  <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                ) : (
                  <MessageCircle className="size-5" aria-hidden="true" />
                )}
                Hacer pedido por WhatsApp
              </a>
              )}
            </>
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
            {payment === "mercadopago" && mercadoPago
              ? "Te llevamos a la página segura de Mercado Pago para pagar con tarjeta, dinero en cuenta o efectivo en puntos de pago. Cuando termines, volvés a la tienda y Natu Mariel coordina la entrega con vos."
              : payment === "transferencia"
                ? "Al tocar el botón se guarda tu pedido y pasás a su página: ahí subís el comprobante y ves cuándo se aprueba el pago."
                : "Al enviar el pedido se abre WhatsApp con el detalle. Natu Mariel te confirmará disponibilidad, pago y entrega. El pedido queda confirmado y el stock reservado recién con esa confirmación."}
          </p>
          <Link href="/productos" className="text-center text-sm font-semibold text-coral-deep hover:underline">
            Seguir comprando
          </Link>
        </div>
      </aside>
    </div>
  );
}
