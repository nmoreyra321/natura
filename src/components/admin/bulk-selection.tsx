"use client";

import { Eye, EyeOff, Loader2, Percent, Tags, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, useTransition } from "react";
import { toast } from "sonner";

import { bulkApplyDiscount, bulkDeleteProducts, bulkUpdateProducts } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";

type Selection = {
  selected: Set<string>;
  toggle: (id: string, on: boolean) => void;
  setAll: (on: boolean) => void;
  allIds: string[];
};

const SelectionContext = createContext<Selection | null>(null);

function useSelection(): Selection {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("Falta BulkSelectionProvider");
  return ctx;
}

/**
 * Selección de varios productos de la página actual y barra de acciones en grupo.
 * Se reinicia al cambiar de página o de filtros (la página le pasa una key distinta).
 */
export function BulkSelectionProvider({
  products,
  categories,
  children,
}: {
  products: { id: string; stock: number }[];
  categories: { id: string; name: string }[];
  children: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allIds = products.map((p) => p.id);
  const value: Selection = {
    selected,
    allIds,
    toggle: (id, on) =>
      setSelected((prev) => {
        const next = new Set(prev);
        if (on) next.add(id);
        else next.delete(id);
        return next;
      }),
    setAll: (on) => setSelected(on ? new Set(allIds) : new Set()),
  };
  const stockById = new Map(products.map((p) => [p.id, p.stock]));

  return (
    <SelectionContext.Provider value={value}>
      {children}
      {selected.size > 0 ? (
        <BulkBar
          ids={[...selected]}
          withoutStock={[...selected].filter((id) => stockById.get(id) === 0).length}
          categories={categories}
          onDone={() => setSelected(new Set())}
        />
      ) : null}
    </SelectionContext.Provider>
  );
}

export function SelectProductCheckbox({ id, name }: { id: string; name: string }) {
  const { selected, toggle } = useSelection();
  return (
    <input
      type="checkbox"
      checked={selected.has(id)}
      onChange={(e) => toggle(id, e.target.checked)}
      aria-label={`Seleccionar ${name}`}
      className="size-5 shrink-0 cursor-pointer accent-[var(--coral-deep)]"
    />
  );
}

export function SelectAllCheckbox() {
  const { selected, setAll, allIds } = useSelection();
  const all = allIds.length > 0 && allIds.every((id) => selected.has(id));
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
      <input
        type="checkbox"
        checked={all}
        ref={(el) => {
          if (el) el.indeterminate = !all && selected.size > 0;
        }}
        onChange={(e) => setAll(e.target.checked)}
        className="size-5 accent-[var(--coral-deep)]"
      />
      Seleccionar los {allIds.length} de esta página
    </label>
  );
}

function BulkBar({
  ids,
  withoutStock,
  categories,
  onDone,
}: {
  ids: string[];
  withoutStock: number;
  categories: { id: string; name: string }[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [category, setCategory] = useState("");
  const [discount, setDiscount] = useState("");
  const discountValue = Number(discount.replace(",", "."));
  const discountOk = discount.trim() !== "" && discountValue >= 0 && discountValue < 100;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const n = ids.length;
  const label = `${n} ${n === 1 ? "producto" : "productos"}`;

  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(res.message ?? "Listo.");
        after?.();
        onDone();
        router.refresh();
      } else {
        toast.error(res.error ?? "Algo salió mal.");
      }
    });

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-forest bg-warm-white px-4 pt-3 shadow-lift lg:left-64"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      role="region"
      aria-label="Acciones para los productos seleccionados"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
        <p className="mr-2 font-bold" aria-live="polite">
          {n} {n === 1 ? "seleccionado" : "seleccionados"}
        </p>
        <button
          type="button"
          disabled={pending}
          className={buttonClasses("primary", "sm")}
          onClick={() =>
            run(
              () => bulkUpdateProducts(ids, { status: "published" }),
              () => {
                if (withoutStock > 0) {
                  toast.info(
                    `${withoutStock} ${withoutStock === 1 ? "tiene" : "tienen"} stock 0: en la tienda ${withoutStock === 1 ? "aparece" : "aparecen"} como «Sin stock».`,
                  );
                }
              },
            )
          }
        >
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          Publicar
        </button>
        <button
          type="button"
          disabled={pending}
          className={buttonClasses("outline", "sm")}
          onClick={() => run(() => bulkUpdateProducts(ids, { status: "draft" }))}
        >
          <EyeOff className="size-4" aria-hidden="true" /> Pasar a borrador
        </button>
        <div className="flex items-center gap-1">
          <label htmlFor="bulk-categoria" className="sr-only">
            Categoría para los seleccionados
          </label>
          <select
            id="bulk-categoria"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="h-9 rounded-full border border-line bg-white px-3 text-sm"
          >
            <option value="">Elegí categoría…</option>
            <option value="ninguna">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !category}
            className={buttonClasses("outline", "sm")}
            onClick={() =>
              run(
                () => bulkUpdateProducts(ids, { category_id: category === "ninguna" ? null : category }),
                () => setCategory(""),
              )
            }
          >
            <Tags className="size-4" aria-hidden="true" /> Asignar
          </button>
        </div>
        <div className="flex items-center gap-1">
          <label htmlFor="bulk-descuento" className="sr-only">
            Descuento sobre la revista para los seleccionados
          </label>
          <input
            id="bulk-descuento"
            inputMode="decimal"
            placeholder="25"
            value={discount}
            onChange={(e) => setDiscount(e.target.value)}
            className="h-9 w-16 rounded-full border border-line bg-white px-3 text-center text-sm"
          />
          <button
            type="button"
            disabled={pending || !discountOk}
            className={buttonClasses("outline", "sm")}
            title="El precio de venta queda como el de revista menos este %"
            onClick={() => run(() => bulkApplyDiscount(ids, discountValue), () => setDiscount(""))}
          >
            <Percent className="size-4" aria-hidden="true" /> Aplicar descuento
          </button>
        </div>
        <button
          type="button"
          disabled={pending}
          className={buttonClasses("ghost", "sm", "text-coral-deep")}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="size-4" aria-hidden="true" /> Eliminar
        </button>
        <button
          type="button"
          onClick={onDone}
          className="ml-auto inline-flex size-9 items-center justify-center rounded-full hover:bg-forest/5"
          aria-label="Quitar la selección"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <ConfirmDialog
        open={confirmDelete}
        title={`¿Eliminar ${label}?`}
        description="Se borran los productos y sus fotos. No se puede deshacer."
        confirmLabel={`Eliminar ${label}`}
        pending={pending}
        confirmWord="BORRAR"
        onConfirm={() => {
          setConfirmDelete(false);
          run(() => bulkDeleteProducts(ids));
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
