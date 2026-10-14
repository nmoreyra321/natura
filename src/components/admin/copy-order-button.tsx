"use client";

import { Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { buttonClasses } from "@/components/ui/button";

/** Copia la lista del pedido (para pegarla donde se haga el pedido) o la abre en WhatsApp. */
export function CopyOrderButtons({ text }: { text: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Lista copiada. Pegala donde hagas el pedido.");
    } catch {
      toast.error("No pudimos copiar. Probá de nuevo.");
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} className={buttonClasses("primary", "md")}>
        <Copy className="size-4" aria-hidden="true" /> Copiar lista
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(text)}`}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonClasses("outline", "md")}
      >
        <MessageCircle className="size-4" aria-hidden="true" /> Mandar por WhatsApp
      </a>
    </div>
  );
}
