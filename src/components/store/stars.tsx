import { Star } from "lucide-react";

/** Estrellas pintadas (de 1 a 5). Con promedio, la estrella a medias se pinta en parte. */
export function Stars({ value, className = "size-4" }: { value: number; className?: string }) {
  return (
    <span className="inline-flex gap-0.5" role="img" aria-label={`${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className="relative inline-block" aria-hidden="true">
            <Star className={`${className} text-line`} fill="currentColor" strokeWidth={0} />
            {fill > 0 ? (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`${className} text-amber-400`} fill="currentColor" strokeWidth={0} />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
