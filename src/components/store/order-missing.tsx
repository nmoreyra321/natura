"use client";

import { MessageCircle, SearchX, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { buttonClasses } from "@/components/ui/button";
import { forgetOrder, useSavedOrders } from "@/lib/my-orders";

/**
 * El pedido ya no existe (por ejemplo, Natu Mariel lo borró). En vez de un error,
 * la clienta puede pedir ayuda por WhatsApp o quitarlo de la lista de su celular.
 */
export function OrderMissing({ id, whatsapp }: { id: string; whatsapp: string | null }) {
  const router = useRouter();
  const saved = useSavedOrders().find((o) => o.id === id);
  const code = saved?.code ?? null;
  const text = code
    ? `Hola Natu Mariel 👋 Quise ver mi pedido ${code} en la página y no aparece. ¿Me ayudás?`
    : "Hola Natu Mariel 👋 Quise ver mi pedido en la página y no aparece. ¿Me ayudás?";

  return (
    <div className="mx-auto max-w-xl px-4 py-10 text-center sm:py-16">
      <SearchX className="mx-auto size-12 text-coral-deep" aria-hidden="true" />
      <h1 className="mt-4 font-display text-3xl font-bold">No encontramos tu pedido</h1>
      <p className="mt-2 text-muted">
        {code ? (
          <>
            El pedido <b className="text-forest">{code}</b> ya no está en la tienda.
          </>
        ) : (
          "Este pedido ya no está en la tienda."
        )}{" "}
        Si lo pagaste o tenés alguna duda, escribile a Natu Mariel y lo resuelve con vos.
      </p>
      <div className="mt-6 flex flex-col gap-3">
        {whatsapp ? (
          <a
            href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonClasses("primary", "lg")}
          >
            <MessageCircle className="size-5" aria-hidden="true" /> Pedir ayuda por WhatsApp
          </a>
        ) : null}
        {saved ? (
          <button
            type="button"
            onClick={() => {
              forgetOrder(id);
              router.push("/mi-pedido");
            }}
            className={buttonClasses("outline", "md")}
          >
            <Trash2 className="size-4" aria-hidden="true" /> Quitarlo de mis pedidos
          </button>
        ) : null}
        <Link href="/productos" className="text-sm font-semibold text-coral-deep hover:underline">
          Seguir mirando productos
        </Link>
      </div>
    </div>
  );
}
