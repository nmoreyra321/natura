"use client";

import { MessageCircle } from "lucide-react";
import { useRouter } from "next/navigation";

import { reportTransferPayment } from "@/app/(tienda)/pedido/actions";
import { buttonClasses } from "@/components/ui/button";

/**
 * Un solo paso: abre WhatsApp con el mensaje armado para mandar el comprobante y, a la vez, le avisa
 * a Natu Mariel (le llega la notificación y el pedido pasa a «verificando pago»).
 */
export function SendProofWhatsApp({ orderId, href }: { orderId: string; href: string }) {
  const router = useRouter();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonClasses("primary", "lg", "w-full")}
      onClick={() => {
        // El enlace se abre solo; el aviso corre en paralelo (si falla, igual le llega el WhatsApp).
        const data = new FormData();
        data.set("orderId", orderId);
        reportTransferPayment(data)
          .catch(() => null)
          .then(() => router.refresh());
      }}
    >
      <MessageCircle className="size-5" aria-hidden="true" /> Enviar comprobante por WhatsApp
    </a>
  );
}
