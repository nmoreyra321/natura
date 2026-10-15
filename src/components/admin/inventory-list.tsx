"use client";

import { Check, Loader2, Minus, Plus } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { setInventoryStock } from "@/app/admin/actions";
import { productImageUrl } from "@/lib/images";

export type InventoryRow = {
  id: string;
  name: string;
  size: string | null;
  image: string | null;
  stock: number;
  status: "draft" | "published";
};

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Carga de stock en lista: se escribe la cantidad y Enter guarda y pasa al siguiente.
 * También guarda al salir del casillero y con los botones − / +.
 */
export function InventoryList({ rows }: { rows: InventoryRow[] }) {
  const [autoPublish, setAutoPublish] = useState(true);
  const listRef = useRef<HTMLUListElement>(null);

  const focusNext = (index: number) => {
    const inputs = listRef.current?.querySelectorAll<HTMLInputElement>("input[data-inventario]");
    const next = inputs?.[index + 1];
    if (next) {
      next.focus();
      next.select();
    } else {
      // Último de la página: se sale del casillero para que se guarde.
      inputs?.[index]?.blur();
    }
  };

  return (
    <div>
      <label className="flex items-start gap-3 rounded-2xl bg-sage/60 p-3 text-sm font-semibold">
        <input
          type="checkbox"
          checked={autoPublish}
          onChange={(e) => setAutoPublish(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[var(--coral-deep)]"
        />
        <span>
          Publicar automáticamente los productos a los que les cargo stock
          <span className="block font-normal text-muted">
            Los que quedan en 0 no cambian: si estaban ocultos, siguen ocultos.
          </span>
        </span>
      </label>

      <ul ref={listRef} className="mt-4 flex flex-col gap-2">
        {rows.map((row, i) => (
          <InventoryItem key={row.id} row={row} index={i} autoPublish={autoPublish} onNext={focusNext} />
        ))}
      </ul>
    </div>
  );
}

function InventoryItem({
  row,
  index,
  autoPublish,
  onNext,
}: {
  row: InventoryRow;
  index: number;
  autoPublish: boolean;
  onNext: (index: number) => void;
}) {
  const [value, setValue] = useState(String(row.stock));
  const [saved, setSaved] = useState(row.stock);
  const [status, setStatus] = useState(row.status);
  const [state, setState] = useState<SaveState>("idle");
  const src = row.image ? productImageUrl(row.image) : null;

  const save = async (raw: string) => {
    if (raw.trim() === "") {
      setValue(String(saved));
      return;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 0 || n > 100_000) {
      toast.error("La cantidad tiene que ser un número entero, 0 o más.");
      setValue(String(saved));
      return;
    }
    setValue(String(n));
    if (n === saved && !(autoPublish && n > 0 && status === "draft")) return;
    setState("saving");
    const res = await setInventoryStock(row.id, n, autoPublish);
    if (res.ok) {
      setSaved(n);
      if (res.data) setStatus(res.data.status);
      setState("saved");
    } else {
      setState("error");
      setValue(String(saved));
      toast.error(res.error);
    }
  };

  const step = (delta: number) => {
    const next = Math.max(0, (Number(value) || 0) + delta);
    setValue(String(next));
    void save(String(next));
  };

  return (
    <li
      className={`flex items-center gap-3 rounded-2xl p-2 pr-3 ${saved > 0 ? "bg-warm-white shadow-soft" : "bg-cream/70"}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-12 shrink-0 rounded-xl bg-white object-cover" loading="lazy" />
      ) : (
        <span className="size-12 shrink-0 rounded-xl bg-white" />
      )}
      <div className="min-w-0 flex-1">
        <Link href={`/admin/productos/${row.id}`} className="line-clamp-2 text-sm leading-snug font-semibold hover:text-coral-deep">
          {row.name}
        </Link>
        <p className="text-xs text-muted">
          {row.size ? `${row.size} · ` : ""}
          <span className={status === "published" ? "font-bold text-botanical-deep" : ""}>
            {status === "published" ? "Publicado" : "Oculto"}
          </span>
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => step(-1)}
          disabled={(Number(value) || 0) <= 0}
          className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-white hover:bg-sun disabled:opacity-40"
          aria-label={`Restar uno a ${row.name}`}
        >
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <label htmlFor={`inv-${row.id}`} className="sr-only">
          Cantidad de {row.name}
        </label>
        <input
          id={`inv-${row.id}`}
          data-inventario
          type="number"
          inputMode="numeric"
          enterKeyHint="next"
          min={0}
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setValue(e.target.value);
            setState("idle");
          }}
          onBlur={(e) => void save(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onNext(index); // al salir del casillero se guarda solo (onBlur)
            }
          }}
          className="h-11 w-16 rounded-xl border-2 border-line bg-white text-center text-lg font-bold tabular focus:border-botanical focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => step(1)}
          className="inline-flex size-9 items-center justify-center rounded-full border border-line bg-white hover:bg-sun"
          aria-label={`Sumar uno a ${row.name}`}
        >
          <Plus className="size-4" aria-hidden="true" />
        </button>
        <span className="flex w-5 justify-center" aria-live="polite">
          {state === "saving" ? (
            <Loader2 className="size-4 animate-spin text-muted" aria-label="Guardando" />
          ) : state === "saved" ? (
            <Check className="size-4 text-botanical-deep" aria-label="Guardado" />
          ) : null}
        </span>
      </div>
    </li>
  );
}
