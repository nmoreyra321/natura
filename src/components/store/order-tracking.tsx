"use client";

import { Check, FileText, ImageUp, Loader2, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { reportTransferPayment } from "@/app/(tienda)/pedido/actions";
import { buttonClasses } from "@/components/ui/button";
import { cart } from "@/lib/cart-store";
import { rememberOrder } from "@/lib/my-orders";
import { MpLinkPay } from "./transfer-account";

/** Guarda el pedido en este celular (para "Seguir mi pedido") y, si recién se hizo, vacía el carrito. */
export function OrderPageEffects({
  id,
  code,
  createdAt,
  isNew,
  remember,
}: {
  id: string;
  code: string;
  createdAt: string;
  isNew: boolean;
  /** Solo se guarda si la clienta lo acaba de hacer o lo buscó (no si alguien abre el enlace de otra). */
  remember: boolean;
}) {
  useEffect(() => {
    if (remember) rememberOrder({ id, code, at: createdAt });
    if (isNew) {
      cart.clear();
      // Si recarga la página más adelante, no vuelve a vaciar un carrito nuevo.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [id, code, createdAt, isNew, remember]);
  return null;
}

/** Vuelve a consultar el pedido cada tanto (mientras se revisa el pago), así la clienta ve la aprobación sola. */
export function AutoRefresh({ seconds = 30 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}

const MAX_SIDE = 1800;

/** Achica la foto en el teléfono (las de cámara pesan mucho). Si no se puede, devuelve null. */
async function shrinkPhoto(file: File): Promise<File | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = new window.Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    return blob ? new File([blob], "comprobante.jpg", { type: "image/jpeg" }) : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** La clienta sube el comprobante y avisa que ya pagó (a Natu Mariel le llega el aviso al celular). */
export function ReportPayment({
  orderId,
  proofOptional = false,
}: {
  orderId: string;
  /** Pago con link de Mercado Pago: el comprobante es opcional y se muestra chiquito. */
  proofOptional?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    let proof = file;
    if (file && file.type.startsWith("image/")) proof = (await shrinkPhoto(file)) ?? file;
    const data = new FormData();
    data.set("orderId", orderId);
    if (proof) data.set("proof", proof);
    const res = await reportTransferPayment(data).catch(() => null);
    if (!res?.ok) {
      setError(res?.error ?? "No pudimos avisar el pago. Revisá tu conexión y probá de nuevo.");
      setSending(false);
      return;
    }
    // No se abre WhatsApp solo (dejaba una pestaña en blanco): a Natu Mariel le llega el aviso al
    // celular, y la página muestra el botón «Avisarle por WhatsApp» por si la clienta quiere.
    toast.success("¡Listo! Natu Mariel va a revisar tu pago.");
    setSending(false);
    router.refresh();
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        id="comprobante"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setError(null);
        }}
      />
      {file ? (
        <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-line">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sage text-botanical-deep">
            {file.type === "application/pdf" ? <FileText className="size-5" aria-hidden="true" /> : <Check className="size-5" aria-hidden="true" />}
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-bold">Comprobante listo</span>
            <span className="block truncate text-muted">{file.name}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              if (input.current) input.current.value = "";
            }}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-coral-soft"
            aria-label="Quitar comprobante"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      ) : proofOptional ? null : (
        <label
          htmlFor="comprobante"
          className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-botanical/60 bg-white/70 p-4 text-center transition-colors hover:bg-white"
        >
          <ImageUp className="size-7 text-botanical-deep" aria-hidden="true" />
          <span className="font-bold">Subir la captura del comprobante</span>
          <span className="text-xs text-muted">Foto o PDF. Tocá acá para elegirla.</span>
        </label>
      )}
      <button type="button" disabled={sending} onClick={send} className={buttonClasses("primary", "lg")}>
        {sending ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Send className="size-5" aria-hidden="true" />}
        {sending ? "Avisando…" : "Ya realicé el pago"}
      </button>
      {proofOptional && !file ? (
        <label
          htmlFor="comprobante"
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 text-sm font-semibold text-coral-deep hover:underline"
        >
          <ImageUp className="size-4" aria-hidden="true" /> Adjuntar comprobante (opcional)
        </label>
      ) : null}
      {error ? (
        <p className="text-sm font-semibold text-coral-deep" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-muted">
        {file
          ? "Al tocar el botón se guarda el comprobante y Natu Mariel recibe el aviso."
          : proofOptional
            ? "Cuando termines de pagar en Mercado Pago, tocá este botón para avisarle a Natu Mariel."
            : "Si no tenés la captura, igual podés avisar: Natu Mariel lo controla en su cuenta."}
      </p>
    </div>
  );
}

const OPENED_EVENT = "natu-mariel:pago-abierto";
const openedKey = (orderId: string) => `natu-mariel:pago-abierto:${orderId}`;

function subscribeOpened(onChange: () => void) {
  window.addEventListener(OPENED_EVENT, onChange);
  return () => window.removeEventListener(OPENED_EVENT, onChange);
}

/**
 * Pago con el link de Mercado Pago. Primero solo se ve «Pagar con Mercado Pago»; cuando la clienta
 * lo toca (queda anotado en su celular), aparece «Ya realicé el pago» para avisarle a Natu Mariel.
 */
export function MpPayFlow({
  orderId,
  link,
  totalCents,
  again,
}: {
  orderId: string;
  link: string;
  totalCents: number;
  again: boolean;
}) {
  const opened = useSyncExternalStore(
    subscribeOpened,
    () => {
      try {
        return window.localStorage.getItem(openedKey(orderId)) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const markOpened = () => {
    try {
      window.localStorage.setItem(openedKey(orderId), "1");
    } catch {
      // Sin almacenamiento: igual se muestra el botón (ver abajo).
    }
    window.dispatchEvent(new Event(OPENED_EVENT));
  };
  const [shown, setShown] = useState(false);
  const showReport = opened || again || shown;

  return (
    <>
      <MpLinkPay
        link={link}
        totalCents={totalCents}
        onOpen={() => {
          markOpened();
          setShown(true);
        }}
      />
      {showReport ? (
        <div className="mt-5 border-t border-botanical/30 pt-4">
          <p className="mb-2 font-bold">¿Ya pagaste?</p>
          <ReportPayment orderId={orderId} proofOptional />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="mt-3 w-full text-center text-xs font-semibold text-muted underline"
        >
          Ya pagué desde otro dispositivo
        </button>
      )}
    </>
  );
}
