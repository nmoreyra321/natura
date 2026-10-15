"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteCancelledOrders } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";

export type CancelledOrderRow = {
  id: string;
  code: string;
  date: string;
  customer: string | null;
  total: string;
  units: number;
};

/** Lista de pedidos cancelados con selección para borrarlos de una vez. */
export function CancelledOrders({ rows }: { rows: CancelledOrderRow[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const all = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const n = selected.size;

  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-warm-white p-3 shadow-soft">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={all}
            ref={(el) => {
              if (el) el.indeterminate = !all && n > 0;
            }}
            onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
            className="size-5 accent-[var(--coral-deep)]"
          />
          Seleccionar los {rows.length} de esta página
        </label>
        <button
          type="button"
          disabled={n === 0 || pending}
          onClick={() => setConfirm(true)}
          className={buttonClasses("primary", "md", "bg-coral-deep")}
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
          Borrar {n > 0 ? n : ""} {n === 1 ? "seleccionado" : "seleccionados"}
        </button>
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {rows.map((r) => (
          <li key={r.id}>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 ${selected.has(r.id) ? "border-coral-deep bg-coral-soft/50" : "border-line bg-warm-white"}`}
            >
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={(e) => toggle(r.id, e.target.checked)}
                className="size-5 shrink-0 accent-[var(--coral-deep)]"
              />
              <span className="min-w-0 flex-1">
                <span className="font-bold">Pedido {r.code}</span>
                <span className="block text-sm text-muted">
                  {r.date}
                  {r.customer ? ` · ${r.customer}` : ""} · {r.units} {r.units === 1 ? "unidad" : "unidades"}
                </span>
              </span>
              <span className="shrink-0 font-semibold tabular">{r.total}</span>
            </label>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={confirm}
        title={`¿Borrar ${n} ${n === 1 ? "pedido cancelado" : "pedidos cancelados"}?`}
        description="Se borran para siempre. No cambia el stock: ya se había devuelto al cancelarlos."
        confirmLabel="Borrar"
        pending={pending}
        confirmWord="BORRAR"
        onConfirm={() => {
          setConfirm(false);
          start(async () => {
            const res = await deleteCancelledOrders([...selected]);
            if (res.ok) {
              toast.success(res.message ?? "Listo.");
              setSelected(new Set());
              router.refresh();
            } else {
              toast.error(res.error);
            }
          });
        }}
        onCancel={() => setConfirm(false)}
      />
    </div>
  );
}
