"use client";

import { Gift, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { giveLoyaltyGift, undoLoyaltyGift } from "@/app/admin/actions";

/** «Regalo entregado» en el club de clientas; con «Deshacer» en el aviso por si se tocó sin querer. */
export function GiftActions({ phone, name }: { phone: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const undo = () =>
    start(async () => {
      const res = await undoLoyaltyGift(phone);
      if (res.ok) {
        toast.success(res.message ?? "Deshecho.");
        router.refresh();
      } else toast.error(res.error ?? "Algo salió mal.");
    });

  const give = () =>
    start(async () => {
      const res = await giveLoyaltyGift(phone);
      if (res.ok) {
        toast.success(res.message ?? "Regalo anotado.", { action: { label: "Deshacer", onClick: undo } });
        router.refresh();
      } else toast.error(res.error ?? "Algo salió mal.");
    });

  return (
    <button
      type="button"
      disabled={pending}
      onClick={give}
      className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-coral-deep px-3.5 text-sm font-bold text-white hover:bg-coral-deep/90 disabled:opacity-50"
      aria-label={`Ya le entregué el regalo a ${name}`}
    >
      <Gift className="size-4" aria-hidden="true" /> Regalo entregado
    </button>
  );
}

/** Para corregir un regalo anotado de más. */
export function UndoGift({ phone }: { phone: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await undoLoyaltyGift(phone);
          if (res.ok) {
            toast.success(res.message ?? "Deshecho.");
            router.refresh();
          } else toast.error(res.error ?? "Algo salió mal.");
        })
      }
      className="inline-flex items-center gap-1 text-xs font-semibold text-muted underline hover:text-coral-deep disabled:opacity-50"
    >
      <Undo2 className="size-3" aria-hidden="true" /> Deshacer último regalo
    </button>
  );
}
