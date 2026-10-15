"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { formatARS } from "@/lib/format";
import type { TransferDetails } from "@/lib/store-settings";

/** Monto como lo escriben las apps de transferencia: "20000" o "20000,50". */
function plainAmount(cents: number): string {
  const pesos = Math.floor(cents / 100);
  const rest = cents % 100;
  return rest ? `${pesos},${String(rest).padStart(2, "0")}` : String(pesos);
}

const MP_WEB = "https://www.mercadopago.com.ar/";

/**
 * Abre la app de Mercado Pago (no el navegador). En Android, si no está instalada,
 * el sistema abre la web en el navegador predeterminado. En iPhone, si no se abrió, avisamos.
 */
function openMercadoPagoApp() {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (/Android/.test(ua)) {
    window.location.href = `intent://home#Intent;scheme=mercadopago;package=com.mercadopago.wallet;S.browser_fallback_url=${encodeURIComponent(MP_WEB)};end`;
    return;
  }
  if (isIOS) {
    const timer = setTimeout(() => {
      if (!document.hidden) toast.info("Si no se abrió, entrá a la app de Mercado Pago y pegá el alias en Transferir.");
    }, 1800);
    document.addEventListener("visibilitychange", () => clearTimeout(timer), { once: true });
    window.location.href = "mercadopago://";
    return;
  }
  // Compu: no hay app, se abre la web en una pestaña nueva.
  window.open(MP_WEB, "_blank", "noopener");
}

/**
 * Datos de la cuenta para transferir, con botones para copiar. Ninguna app permite abrir una
 * transferencia con el alias ya cargado, así que el botón principal copia el alias y abre
 * Mercado Pago: la clienta solo pega.
 */
export function TransferAccount({ transfer, totalCents }: { transfer: TransferDetails; totalCents: number }) {
  const rows = [
    { label: "Alias", value: transfer.alias },
    { label: "CBU/CVU", value: transfer.cbu },
    { label: "Monto", value: plainAmount(totalCents), display: formatARS(totalCents) },
    { label: "Titular", value: transfer.holder, noCopy: true },
    { label: "Banco", value: transfer.bank, noCopy: true },
  ].filter((r) => r.value);
  const key = transfer.alias ?? transfer.cbu ?? "";
  const keyLabel = transfer.alias ? "alias" : "CBU";
  return (
    <>
      <dl className="mt-1.5 flex flex-col gap-1 rounded-xl bg-white/70 px-2.5 py-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <dt className="shrink-0 text-muted">{r.label}</dt>
            <dd className="flex min-w-0 items-center gap-1 font-semibold">
              <span className="truncate font-mono text-[0.85rem]">{r.display ?? r.value}</span>
              {r.noCopy ? null : <CopyButton text={r.value!} label={r.label} />}
            </dd>
          </div>
        ))}
      </dl>
      {key ? (
        <>
          <button
            type="button"
            onClick={() => {
              // Se copia y se abre en el mismo toque (si no, el navegador bloquea la ventana).
              navigator.clipboard
                ?.writeText(key)
                .then(() => toast.success(`${transfer.alias ? "Alias" : "CBU"} copiado: pegalo en Mercado Pago.`))
                .catch(() => toast.info(`Copiá el ${keyLabel}: ${key}`));
              openMercadoPagoApp();
            }}
            className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#009ee3] px-4 font-bold text-white transition-colors hover:bg-[#0089c7]"
          >
            <Copy className="size-4.5" aria-hidden="true" />
            Copiar {keyLabel} y abrir Mercado Pago
          </button>
          <p className="mt-1.5 text-xs text-muted">
            En Mercado Pago tocá <strong>Transferir</strong> y pegá el {keyLabel}. ¿Otro banco o billetera? Pegalo en la
            app que uses.
          </p>
        </>
      ) : null}
    </>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          // Sin permiso para copiar: la clienta lo puede seleccionar a mano.
        }
      }}
      className="inline-flex size-8 shrink-0 items-center justify-center rounded-full hover:bg-white"
      aria-label={copied ? `${label} copiado` : `Copiar ${label}`}
    >
      {copied ? (
        <Check className="size-4 text-botanical-deep" aria-hidden="true" />
      ) : (
        <Copy className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}

/**
 * Botón para pagar con el link de Mercado Pago (sin monto fijo): copia el monto, para que la
 * clienta solo lo pegue, y abre el link.
 */
export function MpLinkPay({ link, totalCents }: { link: string; totalCents: number }) {
  const amount = plainAmount(totalCents);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 rounded-xl bg-white/80 px-3 py-2">
        <span className="text-muted">Monto a pagar</span>
        <span className="flex items-center gap-1 font-display text-xl font-bold tabular">
          {formatARS(totalCents)}
          <CopyButton text={amount} label="Monto" />
        </span>
      </div>
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          navigator.clipboard
            ?.writeText(amount)
            .then(() => toast.success("Monto copiado: pegalo en Mercado Pago."))
            .catch(() => {});
        }}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#009ee3] px-4 text-base font-bold text-white transition-colors hover:bg-[#0089c7]"
      >
        Pagar con Mercado Pago
      </a>
      <p className="text-xs text-muted">
        Se abre Mercado Pago: escribí <strong>{formatARS(totalCents)}</strong> (ya lo copiamos) y pagá con tarjeta o dinero
        en cuenta. Después volvé a esta página.
      </p>
    </div>
  );
}
