"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Eliminar",
  cancelLabel = "Cancelar",
  pending = false,
  confirmWord,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  /** Texto del botón para no hacer nada. */
  cancelLabel?: string;
  pending?: boolean;
  /** Segunda confirmación: hay que escribir esta palabra (ej.: "BORRAR") para habilitar el botón. */
  confirmWord?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState("");
  const wordOk = !confirmWord || typed.trim().toUpperCase() === confirmWord.toUpperCase();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        setTyped("");
        onCancel();
      }}
      className="m-auto w-[min(92vw,440px)] rounded-3xl bg-warm-white p-6 text-forest shadow-lift backdrop:bg-forest/40"
      aria-labelledby="confirm-title"
    >
      <h2 id="confirm-title" className="font-display text-xl font-bold">{title}</h2>
      <p className="mt-2 text-muted">{description}</p>
      {confirmWord ? (
        <label className="mt-4 block text-sm font-semibold">
          Para confirmar, escribí <strong className="text-coral-deep">{confirmWord}</strong>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            className="mt-1 h-11 w-full rounded-full border border-line bg-white px-4 text-base font-bold tracking-wide uppercase focus:border-coral-deep focus:outline-none"
          />
        </label>
      ) : null}
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setTyped("");
            onCancel();
          }}
          disabled={pending}
          autoFocus
        >
          {cancelLabel}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            setTyped("");
            onConfirm();
          }}
          disabled={pending || !wordOk}
        >
          {pending ? "Eliminando…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
