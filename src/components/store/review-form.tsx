"use client";

import { Heart, Loader2, Star } from "lucide-react";
import { useState, useTransition } from "react";

import { submitReview } from "@/app/(tienda)/pedido/actions";
import { buttonClasses } from "@/components/ui/button";

const LABELS = ["", "Mala", "Regular", "Buena", "Muy buena", "¡Excelente!"];

/**
 * Formulario de reseña: nombre, estrellas y reseña (las tres obligatorias). En la página del pedido
 * va con el pedido; en el inicio, sin pedido (`bare`: sin recuadro, para ir dentro de una ventana).
 */
export function ReviewForm({
  orderId,
  defaultName = "",
  bare = false,
}: {
  orderId?: string;
  defaultName?: string;
  bare?: boolean;
}) {
  const [name, setName] = useState(defaultName);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const shown = hover || rating;

  if (done) {
    return (
      <p
        className={`${bare ? "" : "mt-6 "}flex items-center justify-center gap-2 rounded-3xl bg-sage p-4 text-center font-bold text-botanical-deep`}
        role="status"
      >
        <Heart className="size-5" fill="currentColor" aria-hidden="true" />{" "}
        ¡Gracias por tu reseña!
      </p>
    );
  }

  return (
    <form
      className={
        bare
          ? "text-left"
          : "mt-6 rounded-3xl border-2 border-dashed border-line bg-white/70 p-4 text-left"
      }
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        if (name.trim().length < 2) return setError("Escribí tu nombre.");
        if (!rating)
          return setError("Tocá las estrellas para elegir tu puntaje.");
        if (comment.trim().length < 3) return setError("Escribí tu reseña.");
        start(async () => {
          const res = await submitReview({
            orderId: orderId ?? null,
            name,
            rating,
            comment,
          }).catch(() => null);
          if (res?.ok) setDone(true);
          else
            setError(
              res?.error ??
                "No pudimos guardar tu reseña. Revisá tu conexión y probá de nuevo.",
            );
        });
      }}
    >
      {bare ? null : (
        <>
          <h2 className="font-display text-lg font-bold">
            ¿Cómo fue tu compra?
          </h2>
          <p className="text-sm text-muted">
            Si querés, dejá tu reseña. Nos ayuda muchísimo 💖
          </p>
        </>
      )}

      <fieldset className="mt-3">
        <legend className="text-sm font-semibold">Tu puntaje</legend>
        <div
          className="mt-1 flex items-center gap-1"
          onMouseLeave={() => setHover(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`}
              aria-pressed={rating === n}
              className="rounded-full p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={`size-9 ${n <= shown ? "text-amber-400" : "text-line"}`}
                fill="currentColor"
                strokeWidth={0}
                aria-hidden="true"
              />
            </button>
          ))}
          <span className="ml-2 text-sm font-bold text-forest/80">
            {LABELS[shown]}
          </span>
        </div>
      </fieldset>

      <label className="mt-3 block text-sm font-semibold">
        Tu nombre
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="given-name"
          required
          className="mt-1 h-11 w-full rounded-full border border-line bg-white px-4 text-base font-normal"
        />
      </label>
      <label className="mt-3 block text-sm font-semibold">
        Tu reseña
        <textarea
          value={comment}
          required
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="¿Qué te pareció la atención, la entrega o los productos?"
          className="mt-1 w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-base font-normal"
        />
      </label>
      {error ? (
        <p className="mt-2 text-sm font-semibold text-coral-deep" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className={buttonClasses("primary", "md", "mt-3 w-full")}
      >
        {pending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Star className="size-4" aria-hidden="true" />
        )}{" "}
        Publicar mi reseña
      </button>
      <p className="mt-2 text-center text-xs text-muted">
        Se publica en la tienda con tu nombre, tus estrellas y tu reseña.
      </p>
    </form>
  );
}
