import { formatARS } from "@/lib/format";
import { getPriceInfo } from "@/lib/pricing";

/** Sticker de descuento: solo aparece si hay un descuento real. */
export function DiscountBadge({
  magazinePrice,
  salePrice,
  className = "",
  size = "md",
}: {
  magazinePrice: number;
  salePrice: number;
  className?: string;
  size?: "md" | "lg";
}) {
  const info = getPriceInfo(magazinePrice, salePrice);
  if (!info.hasDiscount || info.discountPercent < 1) return null;
  const big = size === "lg";
  return (
    <span
      className={`sticker inline-flex flex-col items-center justify-center rounded-full border-[3px] border-white bg-coral-deep leading-none font-display font-bold text-white shadow-lift tabular ${big ? "size-20 text-2xl" : "size-14 text-lg"} ${className}`}
    >
      −{info.discountPercent}%
      <span className={`font-sans font-extrabold tracking-wide uppercase ${big ? "mt-0.5 text-[0.65rem]" : "text-[0.5rem]"}`}>
        off
      </span>
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
          className={`tabular font-display font-bold tracking-tight ${info.hasDiscount ? "text-coral-deep" : "text-forest"} ${big ? "text-4xl sm:text-5xl" : "text-[1.35rem]"}`}
        >
          <span className="sr-only">{info.hasDiscount ? "Precio Natu Mariel: " : "Precio: "}</span>
          {formatARS(info.saleCents)}
        </span>
        {info.hasDiscount ? (
          <span className={`tabular font-semibold text-muted line-through decoration-coral-deep/60 decoration-2 ${big ? "text-lg" : "text-sm"}`}>
            <span className="sr-only">Precio de revista: </span>
            {formatARS(info.magazineCents)}
          </span>
        ) : null}
      </div>
      {showSavings && info.hasDiscount ? (
        <p className="inline-flex w-fit items-center gap-1.5 rounded-full bg-sun px-3 py-1 text-sm font-extrabold text-forest">
          ¡Ahorrás {formatARS(info.savingsCents)}!
          {info.discountPercent >= 1 ? ` ${info.discountPercent}% menos que en revista` : ""}
        </p>
      ) : null}
    </div>
  );
}
