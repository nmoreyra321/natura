"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteLot, sellFromLot } from "@/app/admin/actions";

/**
 * En «Próximos a vencer»: «Vendido» (resta 1 de la lista y del stock) y
 * «Sacar de la lista» (deja de seguirlo; el stock no cambia).
 */
export function LotActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, success: string) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? success);
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
        onClick={() => run(() => sellFromLot(id), "Vendido.")}
        className="inline-flex h-9 items-center gap-1 rounded-full bg-botanical-deep px-3 text-sm font-semibold text-white hover:bg-[#146347] disabled:opacity-50"
        aria-label={`Vendí uno de ${name}`}
      >
        <Check className="size-4" aria-hidden="true" /> Vendido
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => deleteLot(id), "Lo sacamos de la lista. El stock no cambió.")}
        className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-coral-deep hover:bg-coral-soft disabled:opacity-50"
        aria-label={`Sacar ${name} de la lista`}
      >
        <X className="size-4" aria-hidden="true" /> Sacar de la lista
      </button>
    </div>
  );
}
