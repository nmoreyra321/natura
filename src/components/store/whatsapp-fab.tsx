"use client";

import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";

/**
 * Botón flotante de WhatsApp en el celular, siempre a mano. No aparece en el carrito ni en la
 * página del pedido (ahí ya hay botones de WhatsApp), y en la ficha de producto se corre hacia
 * arriba para no tapar «Agregar al carrito».
 */
export function WhatsAppFab({ url }: { url: string }) {
  const pathname = usePathname();
  if (pathname === "/carrito" || pathname.startsWith("/pedido/")) return null;
  const onProduct = pathname.startsWith("/productos/");
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Escribile a Natu Mariel por WhatsApp"
      className={`fixed right-4 z-30 inline-flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lift transition hover:scale-105 md:hidden ${
        onProduct ? "bottom-24" : "bottom-5"
      }`}
    >
      <MessageCircle className="size-7" aria-hidden="true" />
    </a>
  );
}
