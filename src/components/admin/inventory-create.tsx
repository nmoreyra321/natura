"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { buttonClasses } from "@/components/ui/button";
import { QuickCreateProduct } from "./quick-create-product";

/** En «Stock»: si lo que se buscó no está en la tienda, se puede crear ahí mismo. */
export function InventoryCreate({
  name,
  categories,
  initialOpen = false,
  notFound = true,
}: {
  name: string;
  categories: { id: string; name: string }[];
  /** Abrir directo el formulario (cuando se eligió «Agregar como producto nuevo» en el buscador). */
  initialOpen?: boolean;
  /** false: hubo resultados, pero ninguno es el que se buscaba. */
  notFound?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  if (!open) {
    return (
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sun/50 px-4 py-3 text-sm">
        <span>
          {notFound ? (
            <>
              No encontramos <strong>«{name}»</strong> en la tienda.
            </>
          ) : (
            <>¿No es ninguno de estos?</>
          )}
        </span>
        <button type="button" onClick={() => setOpen(true)} className={buttonClasses("primary", "sm")}>
          <Plus className="size-4" aria-hidden="true" /> Agregar producto nuevo
        </button>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <QuickCreateProduct
        initialName={name}
        quantityLabel="Cuántos tenés"
        categories={categories}
        onCancel={() => setOpen(false)}
        onDone={() => {
          setOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
