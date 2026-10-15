"use client";

import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteProduct, updateProductQuick } from "@/app/admin/actions";
import { ConfirmDialog } from "./confirm-dialog";

export function ProductRowActions({
  id,
  name,
  status,
  stock,
}: {
  id: string;
  name: string;
  slug: string;
  status: "draft" | "published";
  stock: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [stockValue, setStockValue] = useState(String(stock));

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

  const saveStock = () => {
    const n = Number(stockValue);
    if (!Number.isInteger(n) || n < 0) {
      toast.error("El stock tiene que ser un número entero, 0 o mayor.");
      setStockValue(String(stock));
      return;
    }
    if (n === stock) return;
    run(() => updateProductQuick(id, { stock: n }), "Stock actualizado.");
  };

  return (
    <div className="ml-auto flex items-center gap-1">
      <div className="mr-1 flex items-center gap-1.5">
        <label htmlFor={`stock-${id}`} className="text-xs font-semibold text-muted">
          Stock
        </label>
        <input
          id={`stock-${id}`}
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          value={stockValue}
          onChange={(e) => setStockValue(e.target.value)}
          onBlur={saveStock}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          disabled={pending}
          className="h-9 w-16 rounded-xl border border-line bg-white px-1 text-center text-sm tabular focus:border-botanical focus:outline-none"
        />
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          run(
            () => updateProductQuick(id, { status: status === "published" ? "draft" : "published" }),
            status === "published" ? "Producto despublicado." : "¡Producto publicado!",
          )
        }
        className={`inline-flex size-9 items-center justify-center rounded-full ${status === "published" ? "text-muted hover:bg-forest/5 hover:text-forest" : "bg-sage text-botanical-deep hover:bg-botanical-deep hover:text-white"}`}
        aria-label={status === "published" ? `Ocultar ${name} de la tienda` : `Publicar ${name}`}
        title={status === "published" ? "Ocultar de la tienda" : "Publicar en la tienda"}
      >
        {status === "published" ? <Eye className="size-4.5" aria-hidden="true" /> : <EyeOff className="size-4.5" aria-hidden="true" />}
      </button>
      <Link
        href={`/admin/productos/${id}`}
        className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-forest/5 hover:text-forest"
        aria-label={`Editar ${name}`}
        title="Editar"
      >
        <Pencil className="size-4.5" aria-hidden="true" />
      </Link>
      <button
        type="button"
        onClick={() => setConfirm(true)}
        disabled={pending}
        className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-coral-soft hover:text-coral-deep"
        aria-label={`Eliminar ${name}`}
        title="Eliminar"
      >
        <Trash2 className="size-4.5" aria-hidden="true" />
      </button>
      <ConfirmDialog
        open={confirm}
        title="¿Eliminar este producto?"
        description={`Se va a borrar “${name}” con todas sus fotos. Esta acción no se puede deshacer.`}
        pending={pending}
        confirmWord="BORRAR"
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          start(async () => {
            const res = await deleteProduct(id);
            setConfirm(false);
            if (res.ok) {
              toast.success("Producto eliminado.");
              router.refresh();
            } else toast.error(res.error);
          })
        }
      />
    </div>
  );
}
