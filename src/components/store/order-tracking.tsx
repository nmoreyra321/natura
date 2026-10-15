"use client";

import { Check, FileText, ImageUp, Loader2, Send, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { reportTransferPayment } from "@/app/(tienda)/pedido/actions";
import { buttonClasses } from "@/components/ui/button";
import { cart } from "@/lib/cart-store";
import { rememberOrder } from "@/lib/my-orders";

/** Guarda el pedido en este celular (para "Seguir mi pedido") y, si recién se hizo, vacía el carrito. */
export function OrderPageEffects({ id, code, createdAt, isNew }: { id: string; code: string; createdAt: string; isNew: boolean }) {
  useEffect(() => {
    rememberOrder({ id, code, at: createdAt });
    if (isNew) {
      cart.clear();
      // Si recarga la página más adelante, no vuelve a vaciar un carrito nuevo.
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [id, code, createdAt, isNew]);
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

/** La clienta sube el comprobante y avisa que ya transfirió. Después se abre WhatsApp para avisarle a Mariel. */
export function ReportPayment({
  orderId,
  whatsappUrl,
  again,
  proofOptional = false,
}: {
  orderId: string;
  whatsappUrl: string | null;
  again: boolean;
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
    // La pestaña de WhatsApp se abre ya (durante el toque) para que el navegador no la bloquee.
    const win = whatsappUrl ? window.open("", "_blank") : null;
    let proof = file;
    if (file && file.type.startsWith("image/")) proof = (await shrinkPhoto(file)) ?? file;
    const data = new FormData();
    data.set("orderId", orderId);
    if (proof) data.set("proof", proof);
    const res = await reportTransferPayment(data).catch(() => null);
    if (!res?.ok) {
      win?.close();
      setError(res?.error ?? "No pudimos avisar el pago. Revisá tu conexión y probá de nuevo.");
      setSending(false);
      return;
    }
    if (win && whatsappUrl) {
      win.opener = null;
      win.location.href = whatsappUrl;
    }
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
        {sending ? "Avisando…" : again ? "Ya pagué de nuevo" : "Ya pagué"}
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
          ? "Al tocar el botón se guarda el comprobante y se abre WhatsApp para avisarle a Natu Mariel."
          : proofOptional
            ? "Natu Mariel ve el pago en su cuenta de Mercado Pago y lo aprueba. Te avisamos acá y por WhatsApp."
            : "Si no tenés la captura, igual podés avisar: Natu Mariel lo controla en su cuenta."}
      </p>
    </div>
  );
}
