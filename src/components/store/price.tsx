import { formatARS } from "@/lib/format";
import { getPriceInfo } from "@/lib/pricing";

export function DiscountBadge({
  magazinePrice,
  salePrice,
  className = "",
}: {
  magazinePrice: number;
  salePrice: number;
  className?: string;
}) {
  const info = getPriceInfo(magazinePrice, salePrice);
  if (!info.hasDiscount || info.discountPercent < 1) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full bg-coral-deep px-2.5 py-1 text-xs font-bold tracking-wide text-white tabular ${className}`}
    >
      −{info.discountPercent}%
    </span>
  );
}

/** Precio especial destacado; precio de revista tachado solo si hay descuento real. */
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
  const big = size === "lg";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span
          className={`tabular font-extrabold tracking-tight ${info.hasDiscount ? "text-coral-deep" : "text-forest"} ${big ? "text-3xl sm:text-4xl" : "text-xl"}`}
        >
          <span className="sr-only">{info.hasDiscount ? "Precio Natu Mariel: " : "Precio: "}</span>
          {formatARS(info.saleCents)}
        </span>
        {info.hasDiscount ? (
          <span className={`tabular text-muted line-through ${big ? "text-lg" : "text-sm"}`}>
            <span className="sr-only">Precio de revista: </span>
            {formatARS(info.magazineCents)}
          </span>
        ) : null}
      </div>
      {showSavings && info.hasDiscount ? (
        <p className="text-sm font-semibold text-botanical-deep">
          Ahorrás {formatARS(info.savingsCents)}
          {info.discountPercent >= 1 ? ` (${info.discountPercent}% menos que en revista)` : ""}
        </p>
      ) : null}
    </div>
  );
}
