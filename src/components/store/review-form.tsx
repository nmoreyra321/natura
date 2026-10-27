"use client";

import { Camera, Heart, Loader2, Star, X } from "lucide-react";
import { useState, useTransition } from "react";

import { submitReview } from "@/app/(tienda)/pedido/actions";
import { buttonClasses } from "@/components/ui/button";
import { shrinkPhoto } from "@/lib/shrink-photo";
import { Required, RequiredNote } from "./required";

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
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const shown = hover || rating;
  const pickPhoto = (file: File | null) => {
    if (preview) URL.revokeObjectURL(preview);
    setPhoto(file);
    setPreview(file ? URL.createObjectURL(file) : null);
  };

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
        if (
          name
            .trim()
            .split(/\s+/)
            .filter((w) => w.length >= 2).length < 2
        )
          return setError("Escribí tu nombre y apellido.");
        if (!rating)
          return setError("Tocá las estrellas para elegir tu puntaje.");
        if (comment.trim().length < 3) return setError("Escribí tu reseña.");
        start(async () => {
          const data = new FormData();
          if (orderId) data.set("orderId", orderId);
          data.set("name", name);
          data.set("rating", String(rating));
          data.set("comment", comment);
          if (photo) {
            const small = await shrinkPhoto(photo);
            if (!small)
              return setError(
                "No pudimos preparar la foto. Probá con otra o publicá la reseña sin foto.",
              );
            data.set("photo", small);
          }
          const res = await submitReview(data).catch(() => null);
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

      <RequiredNote className="mt-2" />
      <fieldset className="mt-2">
        <legend className="text-sm font-semibold">
          Tu puntaje
          <Required />
        </legend>
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
        Tu nombre y apellido
        <Required />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="given-name"
          required
          className="mt-1 h-11 w-full rounded-full border border-line bg-white px-4 text-base font-normal"
        />
        <span className="mt-1 block px-1 text-xs font-normal text-muted">
          Así se publica en la tienda, por ejemplo «Laura Gómez».
        </span>
      </label>
      <label className="mt-3 block text-sm font-semibold">
        Tu reseña
        <Required />
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
      <div className="mt-3">
        {preview ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Tu foto"
              className="size-16 rounded-2xl object-cover"
            />
            <button
              type="button"
              onClick={() => pickPhoto(null)}
              className="inline-flex items-center gap-1 text-sm font-semibold text-coral-deep"
            >
              <X className="size-4" aria-hidden="true" /> Sacar la foto
            </button>
          </div>
        ) : (
          <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold hover:bg-cream">
            <Camera className="size-4" aria-hidden="true" /> Agregar una foto
            (opcional)
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => pickPhoto(e.target.files?.[0] ?? null)}
            />
          </label>
        )}
      </div>
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
