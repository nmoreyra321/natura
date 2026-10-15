"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import { AddReview } from "./add-review";
import { InfiniteCarousel } from "./infinite-carousel";

/** Franja finita de reseñas: el resumen siempre a la vista y el carrusel solo si la clienta lo abre. */
export function ReviewsStrip({
  summary,
  cards,
}: {
  summary: React.ReactNode;
  cards: React.ReactNode[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-auto max-w-7xl rounded-3xl bg-gradient-to-r from-lilac to-blush px-5 py-3 shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        {summary}
        <span className="flex flex-wrap items-center gap-2">
          {cards.length > 0 ? (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 rounded-full bg-white px-3.5 py-1.5 text-sm font-bold text-coral-deep hover:bg-white/80"
            >
              {open ? "Ocultar" : "Ver reseñas"}
              <ChevronDown
                className={`size-4 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden="true"
              />
            </button>
          ) : null}
          <AddReview />
        </span>
      </div>
      {open ? (
        <div className="mt-3">
          {cards.length >= 3 ? (
            <InfiniteCarousel label="Reseñas de clientas">
              {cards}
            </InfiniteCarousel>
          ) : (
            <ul
              aria-label="Reseñas de clientas"
              className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-2 pb-2 sm:mx-0 sm:px-1"
            >
              {cards}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
