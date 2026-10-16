"use client";

import { Loader2, MessageCircleReply, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { replyReview } from "@/app/admin/actions";
import { suggestReply } from "@/lib/review-reply";

/** Contestar una reseña: la respuesta se ve en la tienda debajo de la reseña. */
export function ReviewReply({
  id,
  reply,
  review,
  otherReplies,
}: {
  id: string;
  reply: string | null;
  /** La reseña, para armar una idea de respuesta. */
  review: { name: string; rating: number; comment: string | null };
  /** Las respuestas ya escritas a otras reseñas, para no repetirlas. */
  otherReplies: string[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(reply ?? "");
  const [pending, start] = useTransition();
  const [suggested, setSuggested] = useState(false);

  const suggest = () => {
    setText((prev) => suggestReply(review, { others: otherReplies, previous: prev }));
    setSuggested(true);
  };

  const save = (value: string) =>
    start(async () => {
      const res = await replyReview(id, value).catch(() => null);
      if (res?.ok) {
        toast.success(res.message ?? "Listo.");
        setEditing(false);
        router.refresh();
      } else {
        toast.error(
          res && !res.ok
            ? res.error
            : "No pudimos guardar la respuesta. Probá de nuevo.",
        );
      }
    });

  if (!editing) {
    return reply ? (
      <div className="mt-2 rounded-2xl bg-blush/60 p-3 text-sm">
        <b className="block text-coral-deep">Tu respuesta</b>
        {reply}
        <span className="mt-1 flex gap-3">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-semibold text-botanical-deep underline"
          >
            Cambiar
          </button>
          <button
            type="button"
            onClick={() => save("")}
            disabled={pending}
            className="font-semibold text-muted underline disabled:opacity-50"
          >
            Borrar respuesta
          </button>
        </span>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3.5 text-sm font-bold text-botanical-deep ring-1 ring-line hover:bg-sage"
      >
        <MessageCircleReply className="size-4" aria-hidden="true" /> Contestar
      </button>
    );
  }

  return (
    <form
      className="mt-2 flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) return toast.error("Escribí tu respuesta.");
        save(text);
      }}
    >
      <button
        type="button"
        onClick={suggest}
        className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-lilac px-3.5 text-sm font-bold text-grape hover:bg-pink"
      >
        <Sparkles className="size-4" aria-hidden="true" />
        {suggested ? "Otra idea" : "Sugerir respuesta"}
      </button>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={3}
        autoFocus
        placeholder="¡Gracias por tu compra! …"
        aria-label="Tu respuesta"
        className="w-full rounded-2xl border border-line bg-white px-4 py-2.5 text-base"
      />
      <span className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-coral-deep px-4 text-sm font-bold text-white disabled:opacity-50"
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}{" "}
          Publicar respuesta
        </button>
        <button
          type="button"
          onClick={() => {
            setText(reply ?? "");
            setEditing(false);
          }}
          className="h-9 rounded-full px-3 text-sm font-semibold text-muted"
        >
          Cancelar
        </button>
      </span>
    </form>
  );
}
