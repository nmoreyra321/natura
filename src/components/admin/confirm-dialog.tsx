"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Eliminar",
  pending = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
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
        onCancel();
      }}
      className="m-auto w-[min(92vw,440px)] rounded-3xl bg-warm-white p-6 text-forest shadow-lift backdrop:bg-forest/40"
      aria-labelledby="confirm-title"
    >
      <h2 id="confirm-title" className="font-display text-xl font-bold">{title}</h2>
      <p className="mt-2 text-muted">{description}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={pending} autoFocus>
          Cancelar
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={pending}>
          {pending ? "Eliminando…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
