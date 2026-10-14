"use client";

import { Minus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { changeLotQuantity, deleteLot } from "@/app/admin/actions";

/** "Restar 1" (al vender o usar una unidad) y "Ya no lo tengo" para un lote. */
export function LotActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, success: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else {
        toast.error(res.error ?? "Algo salió mal.");
      }
    });

  return (
    <div className="flex shrink-0 gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => changeLotQuantity(id, -1), "Restamos una unidad.")}
        className="inline-flex h-9 items-center gap-1 rounded-full border border-line px-3 text-sm font-semibold hover:bg-sun disabled:opacity-50"
        aria-label={`Restar una unidad de ${name}`}
      >
        <Minus className="size-4" aria-hidden="true" /> 1
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => deleteLot(id), "Lote quitado de la lista.")}
        className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-coral-deep hover:bg-coral-soft disabled:opacity-50"
        aria-label={`Ya no tengo ${name}`}
      >
        <Trash2 className="size-4" aria-hidden="true" /> Ya no lo tengo
      </button>
    </div>
  );
}
