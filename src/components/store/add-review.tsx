"use client";

import { PenLine, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { ReviewForm } from "./review-form";

/** Botón «Dejar mi reseña» del inicio: abre una ventana con el formulario. */
export function AddReview() {
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
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-coral-deep px-3.5 py-1.5 text-sm font-bold text-white transition hover:brightness-110"
      >
        <PenLine className="size-4" aria-hidden="true" /> Dejar mi reseña
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
              Dejá tu reseña
            </h2>
            <p className="text-sm text-muted">
              Contanos cómo te fue con Natu Mariel 💖
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
        {open ? <ReviewForm key={round} bare /> : null}
      </dialog>
    </>
  );
}
