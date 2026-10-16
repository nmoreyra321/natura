import { LOW_STOCK_THRESHOLD } from "@/lib/config";

export function StockBadge({ stock, className = "" }: { stock: number; className?: string }) {
  if (stock <= 0) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm font-semibold text-muted ${className}`}>
        <span className="size-2 rounded-full bg-muted/60" aria-hidden="true" />
        Agotado
      </span>
    );
  }
  if (stock <= LOW_STOCK_THRESHOLD) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm font-semibold text-coral-deep ${className}`}>
        <span className="size-2 rounded-full bg-coral" aria-hidden="true" />
        {stock === 1 ? "¡Última unidad!" : `Últimas ${stock} unidades`}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold text-botanical-deep ${className}`}>
      <span className="size-2 rounded-full bg-botanical" aria-hidden="true" />
      Disponible
    </span>
  );
}
