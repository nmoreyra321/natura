"use client";

import { Loader2, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteSelected, type DeleteKind } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";

type Ctx = { selected: Set<string>; toggle: (id: string, on: boolean) => void };
const SelectionContext = createContext<Ctx | null>(null);

const TEXTS: Record<DeleteKind, { one: string; many: string; warning: string }> = {
  orders: {
    one: "pedido",
    many: "pedidos",
    warning:
      "Se borran con todo: productos, pagos anotados y comprobante. Si habían descontado stock, se devuelve. No se puede deshacer.",
  },
  restock: { one: "aviso", many: "avisos", warning: "Las clientas ya no van a figurar como esperando el producto. No se puede deshacer." },
  lots: { one: "vencimiento", many: "vencimientos", warning: "Se borran de la lista de vencimientos. El stock no cambia. No se puede deshacer." },
  receipts: {
    one: "factura",
    many: "facturas",
    warning: "Se borran del historial. El stock que ya se sumó no cambia. No se puede deshacer.",
  },
};

/**
 * Elegir varios registros con casilleros y borrarlos, con doble confirmación:
 * primero el botón «Borrar», después escribir BORRAR en el cartel.
 */
export function SelectToDelete({ kind, ids, children }: { kind: DeleteKind; ids: string[]; children: React.ReactNode }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const t = TEXTS[kind];
  const count = [...selected].filter((id) => ids.includes(id)).length;
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <SelectionContext.Provider value={{ selected, toggle }}>
      {children}
      {count > 0 ? (
        <div className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-xl flex-wrap items-center justify-between gap-2 rounded-3xl bg-forest p-3 text-white shadow-lift">
          <span className="pl-2 font-bold">
            {count} {count === 1 ? `${t.one} elegido` : `${t.many} elegidos`}
          </span>
          <span className="flex gap-2">
            {count < ids.length ? (
              <button type="button" onClick={() => setSelected(new Set(ids))} className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-white/10">
                Elegir todos ({ids.length})
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="inline-flex size-10 items-center justify-center rounded-full hover:bg-white/10"
              aria-label="Quitar la selección"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <button type="button" disabled={pending} onClick={() => setConfirming(true)} className={buttonClasses("danger", "md")}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
              Borrar
            </button>
          </span>
        </div>
      ) : null}
      <ConfirmDialog
        open={confirming}
        title={`¿Borrar ${count} ${count === 1 ? t.one : t.many}?`}
        description={t.warning}
        confirmWord="BORRAR"
        confirmLabel="Borrar definitivamente"
        pending={pending}
        onCancel={() => setConfirming(false)}
        onConfirm={() =>
          start(async () => {
            const res = await deleteSelected(kind, [...selected].filter((id) => ids.includes(id)));
            setConfirming(false);
            if (!res.ok) {
              toast.error(res.error);
              router.refresh();
              return;
            }
            toast.success(res.message ?? "Borrado.");
            setSelected(new Set());
            router.refresh();
          })
        }
      />
    </SelectionContext.Provider>
  );
}

/** Casillero para elegir un registro (dentro de <SelectToDelete>). */
export function SelectBox({ id, label, className = "" }: { id: string; label: string; className?: string }) {
  const ctx = useContext(SelectionContext);
  if (!ctx) return null;
  return (
    <input
      type="checkbox"
      checked={ctx.selected.has(id)}
      onChange={(e) => ctx.toggle(id, e.target.checked)}
      aria-label={`Elegir ${label}`}
      className={`size-5 shrink-0 cursor-pointer accent-[var(--coral-deep)] ${className}`}
    />
  );
}
