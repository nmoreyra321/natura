"use client";

import { PenLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ReviewForm } from "./review-form";

/**
 * Botón que abre una ventana con el formulario de reseña. En el inicio es «Dejar mi reseña»;
 * en la página del pedido va con el pedido y el nombre ya cargado.
 */
export function AddReview({
  orderId,
  defaultName,
  label = "Dejar mi reseña",
  className = "inline-flex shrink-0 items-center gap-1.5 rounded-full bg-coral-deep px-3.5 py-1.5 text-sm font-bold text-white transition hover:brightness-110",
}: {
  orderId?: string;
  defaultName?: string;
  label?: string;
  className?: string;
} = {}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  // Cada vez que se abre, el formulario arranca vacío.
  const [round, setRound] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const close = () => {
    setOpen(false);
    router.refresh();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setRound((r) => r + 1);
          setOpen(true);
        }}
        className={className}
      >
        <PenLine className="size-4" aria-hidden="true" /> {label}
      </button>
      <dialog
        ref={ref}
        onCancel={(e) => {
          e.preventDefault();
          close();
        }}
        aria-labelledby="dejar-resena"
        className="m-auto max-h-[92dvh] w-[min(92vw,460px)] overflow-y-auto rounded-3xl bg-warm-white p-6 text-forest shadow-lift backdrop:bg-forest/40"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="dejar-resena" className="font-display text-xl font-bold">
              {orderId ? "¿Cómo viene tu compra?" : "Dejá tu reseña"}
            </h2>
            <p className="text-sm text-muted">
              {orderId
                ? "Es opcional y nos ayuda muchísimo 💖"
                : "¿Ya nos compraste? Si es así, nos ayudaría mucho que nos cuentes brevemente tu experiencia, así otras clientas conocen cómo atendemos y cómo trabajamos. ¡Te lo agradecemos muchísimo! 💖"}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Cerrar"
            className="rounded-full p-1.5 hover:bg-line/50"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>
        {open ? <ReviewForm key={round} bare orderId={orderId} defaultName={defaultName} /> : null}
      </dialog>
    </>
  );
}
