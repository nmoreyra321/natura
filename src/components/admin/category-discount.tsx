"use client";

import { Percent } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { applyCategoryDiscount } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "./confirm-dialog";

/** Descuento para toda una categoría (ej.: 20 % a todos los perfumes). */
export function CategoryDiscount({ categories }: { categories: { id: string; name: string; total: number; percent: number; offer: boolean }[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState("");
  const [percent, setPercent] = useState("");
  const [markOffer, setMarkOffer] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  const category = categories.find((c) => c.id === categoryId);
  const n = Number(percent.replace(",", "."));
  const valid = Boolean(category) && percent.trim() !== "" && Number.isFinite(n) && n >= 0 && n < 100;

  return (
    <section className="rounded-3xl bg-gradient-to-br from-blush to-lilac/70 p-5 shadow-soft">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <Percent className="size-5 text-coral-deep" aria-hidden="true" /> Descuento por categoría
      </h2>
      <p className="mt-1 text-sm text-forest/80">
        Pone el precio de todos los productos de una categoría como el de revista menos el %. Por ejemplo: 20 % a toda
        Perfumería. Para volver al precio de revista, poné 0.
      </p>
      <p className="mt-1 text-xs text-muted">
        Queda guardado: los productos nuevos de esa categoría, o los que cambien de precio con la revista, toman el
        descuento solos.
      </p>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return toast.error("Elegí la categoría y escribí el % (de 0 a 99).");
          setConfirm(true);
        }}
      >
        <label className="flex min-w-48 flex-1 flex-col text-sm font-semibold">
          Categoría
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              const chosen = categories.find((c) => c.id === e.target.value);
              if (chosen) {
                setPercent(chosen.percent > 0 ? String(chosen.percent).replace(".", ",") : "");
                setMarkOffer(chosen.percent > 0 ? chosen.offer : true);
              }
            }}
            className="mt-1 h-11 rounded-2xl border border-line bg-white px-3 text-base font-normal"
          >
            <option value="">Elegí una…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.total} {c.total === 1 ? "producto" : "productos"})
                {c.percent > 0 ? ` · ${String(c.percent).replace(".", ",")} % guardado` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col text-sm font-semibold">
          Descuento
          <span className="mt-1 flex items-center gap-1">
            <input
              inputMode="decimal"
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              placeholder="20"
              className="h-11 w-20 rounded-2xl border border-line bg-white px-3 text-right text-base font-normal tabular"
            />
            %
          </span>
        </label>
        <button type="submit" disabled={pending} className={buttonClasses("primary", "md", "h-11")}>
          Aplicar
        </button>
        <label className="flex w-full items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={markOffer} onChange={(e) => setMarkOffer(e.target.checked)} className="size-5 accent-[var(--coral-deep)]" />
          Mostrarlos también en «Ofertas»
        </label>
      </form>
      <ConfirmDialog
        open={confirm}
        title={`¿${n}% de descuento a toda ${category?.name ?? "la categoría"}?`}
        description={`Se cambia el precio de los ${category?.total ?? 0} productos de ${category?.name ?? "la categoría"}: precio de revista menos ${n}%. Los que no tienen precio de revista no se tocan.`}
        confirmLabel="Sí, aplicar"
        cancelLabel="No"
        pending={pending}
        onCancel={() => setConfirm(false)}
        onConfirm={() =>
          start(async () => {
            const res = await applyCategoryDiscount({ categoryId, percent: n, markOffer });
            setConfirm(false);
            if (res.ok) {
              toast.success(res.message ?? "Listo.");
              setPercent("");
              router.refresh();
            } else toast.error(res.error);
          })
        }
      />
    </section>
  );
}
