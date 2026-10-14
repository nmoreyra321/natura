"use client";

import { MessageCircle } from "lucide-react";
import { useEffect } from "react";

import { buttonClasses } from "@/components/ui/button";
import { cart } from "@/lib/cart-store";

/** Pedido pagado: vacía el carrito y ofrece avisarle a Mariel por WhatsApp. */
export function PaidOrderActions({ whatsappUrl }: { whatsappUrl: string | null }) {
  useEffect(() => {
    cart.clear();
  }, []);

  if (!whatsappUrl) return null;
  return (
    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("whatsapp", "lg")}>
      <MessageCircle className="size-5" aria-hidden="true" />
      Avisar a Natu Mariel por WhatsApp
    </a>
  );
}
