"use client";

import { Check, Link2, MessageCircle, Share2, ThumbsUp } from "lucide-react";
import { useState } from "react";

import { buttonClasses } from "@/components/ui/button";

/**
 * Compartir un producto. En el celular abre el menú de compartir del sistema
 * (WhatsApp, Facebook, Instagram…); en la compu muestra WhatsApp, Facebook y copiar link.
 */
export function ShareButton({ title, text, url }: { title: string; text: string; url: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    setOpen((v) => !v);
  };

  const message = encodeURIComponent(`${text}\n${url}`);
  return (
    <div className="relative">
      <button type="button" onClick={share} className={buttonClasses("outline", "lg", "w-full")} aria-expanded={open}>
        <Share2 className="size-5" aria-hidden="true" /> Compartir
      </button>
      {open ? (
        <div className="mt-2 grid grid-cols-3 gap-2">
          <a
            href={`https://wa.me/?text=${message}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 rounded-2xl bg-warm-white p-3 text-xs font-bold shadow-soft hover:bg-sun/50"
          >
            <MessageCircle className="size-5 text-[#1f8a4c]" aria-hidden="true" /> WhatsApp
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center gap-1 rounded-2xl bg-warm-white p-3 text-xs font-bold shadow-soft hover:bg-sun/50"
          >
            <ThumbsUp className="size-5 text-[#1877f2]" aria-hidden="true" /> Facebook
          </a>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(url);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              } catch {
                // Sin permiso para copiar.
              }
            }}
            className="flex flex-col items-center gap-1 rounded-2xl bg-warm-white p-3 text-xs font-bold shadow-soft hover:bg-sun/50"
          >
            {copied ? <Check className="size-5 text-botanical-deep" aria-hidden="true" /> : <Link2 className="size-5" aria-hidden="true" />}
            {copied ? "¡Copiado!" : "Copiar link"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
