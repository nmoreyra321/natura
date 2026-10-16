import { formatARS } from "@/lib/format";
import { getPriceInfo } from "@/lib/pricing";

/**
 * Precio: cuando hay descuento se muestra bien claro la comparación «Precio en revista» (tachado)
 * contra «Precio en Natu Mariel», y cuánto se ahorra. Sin descuento, solo el precio.
 */
export function Price({
  magazinePrice,
  salePrice,
  size = "md",
  showSavings = false,
}: {
  magazinePrice: number;
  salePrice: number;
  size?: "md" | "lg";
  showSavings?: boolean;
}) {
  const info = getPriceInfo(magazinePrice, salePrice);

  if (!info.hasDiscount) {
    return (
      <span className={`tabular font-display font-bold tracking-tight text-forest ${size === "lg" ? "text-4xl sm:text-5xl" : "text-[1.35rem]"}`}>
        <span className="sr-only">Precio: </span>
        {formatARS(info.saleCents)}
      </span>
    );
  }

  if (size === "lg") {
    return (
      <div className="flex w-full max-w-md flex-col gap-2">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] overflow-hidden rounded-3xl border-2 border-coral-deep/25 bg-white">
          <div className="flex flex-col justify-center gap-0.5 bg-cream/70 p-3 sm:p-4">
            <span className="text-[0.7rem] font-extrabold tracking-wide text-muted uppercase sm:text-xs">Precio en revista</span>
            <span className="tabular text-lg font-bold break-words text-muted line-through decoration-coral-deep decoration-2 sm:text-2xl">
              {formatARS(info.magazineCents)}
            </span>
          </div>
          <div className="flex flex-col justify-center gap-0.5 bg-coral-soft/60 p-3 sm:p-4">
            <span className="text-[0.7rem] font-extrabold tracking-wide text-coral-deep uppercase sm:text-xs">Precio en Natu Mariel</span>
            <span className="tabular font-display text-2xl leading-none font-bold tracking-tight break-words text-coral-deep sm:text-4xl">
              {formatARS(info.saleCents)}
            </span>
          </div>
        </div>
        {showSavings ? (
          <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-sun px-3.5 py-1.5 text-sm font-extrabold text-forest">
            ¡Ahorrás {formatARS(info.savingsCents)}!{info.discountPercent >= 1 ? ` Un ${info.discountPercent}% menos que en la revista` : ""}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold text-muted">
        Revista <span className="tabular font-bold line-through decoration-coral-deep decoration-2">{formatARS(info.magazineCents)}</span>
      </span>
      <span className="tabular font-display text-[1.35rem] leading-tight font-bold tracking-tight text-coral-deep">
        <span className="sr-only">Precio en Natu Mariel: </span>
        {formatARS(info.saleCents)}
      </span>
      <span className="w-fit rounded-full bg-sun px-2 py-0.5 text-[0.7rem] font-extrabold text-forest">Ahorrás {formatARS(info.savingsCents)}</span>
    </div>
  );
}
