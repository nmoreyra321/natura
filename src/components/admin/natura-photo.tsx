"use client";

import { ImageDown, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { importNaturaPhotos } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { inputClasses } from "@/components/ui/fields";

/**
 * "Traer foto de Natura": con el código (o el enlace de la ficha) baja las fotos oficiales y
 * reemplaza las que habían venido de Natura (las fotos propias quedan). Si el producto ya tiene
 * código de Natura, viene escrito.
 */
export function NaturaPhoto({ productId, sku, onDone }: { productId: string; sku: string | null; onDone?: () => void }) {
  const router = useRouter();
  const [ref, setRef] = useState(sku?.replace("NATARG-", "") ?? "");
  const [pending, start] = useTransition();

  const run = () =>
    start(async () => {
      const res = await importNaturaPhotos(productId, ref);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const n = res.data?.added ?? 0;
      if (res.data?.same) toast.success("Ya tiene las fotos actuales de Natura.");
      else toast.success(n === 1 ? "Listo: se puso la foto de Natura." : `Listo: se pusieron ${n} fotos de Natura.`);
      onDone?.();
      router.refresh();
    });

  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        run();
      }}
    >
      <label className="sr-only" htmlFor={`nat-${productId}`}>
        Código o enlace de Natura
      </label>
      <input
        id={`nat-${productId}`}
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="Código de Natura o enlace del producto"
        autoComplete="off"
        className={`${inputClasses} h-11 min-w-0 flex-1`}
      />
      <button type="submit" disabled={pending || !ref.trim()} className={buttonClasses("secondary", "md", "shrink-0")}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ImageDown className="size-4" aria-hidden="true" />}
        Traer foto de Natura
      </button>
    </form>
  );
}
