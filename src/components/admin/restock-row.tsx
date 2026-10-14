"use client";

import { MessageCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteRestockRequest, markRestockNotified } from "@/app/admin/actions";
import { buttonClasses } from "@/components/ui/button";

/** Una clienta esperando un producto: avisarle por WhatsApp (y marcar avisada) o borrar. */
export function RestockRow({
  id,
  name,
  phone,
  date,
  productName,
  productUrl,
  inStock,
}: {
  id: string;
  name: string | null;
  phone: string;
  date: string;
  productName: string;
  productUrl: string;
  inStock: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const saludo = name ? `Hola, ${name.split(" ")[0]}.` : "Hola.";
  const text = `${saludo} Te escribimos de Natu Mariel: ya volvió a ingresar ${productName}. Lo podés ver y pedir acá: ${productUrl}`;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
      <span className="min-w-0">
        <span className="font-semibold">{name ?? "Sin nombre"}</span>
        <span className="block text-xs text-muted">
          +{phone} · se anotó el {date}
        </span>
      </span>
      <span className="flex gap-1.5">
        <a
          href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() =>
            start(async () => {
              await markRestockNotified(id);
              router.refresh();
            })
          }
          aria-disabled={pending}
          className={buttonClasses(inStock ? "whatsapp" : "outline", "sm")}
        >
          <MessageCircle className="size-4" aria-hidden="true" /> Avisar
        </a>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await deleteRestockRequest(id);
              if (res.ok) {
                toast.success(res.message ?? "Listo.");
                router.refresh();
              } else {
                toast.error(res.error);
              }
            })
          }
          className="inline-flex size-9 items-center justify-center rounded-full text-muted hover:bg-coral-soft hover:text-coral-deep"
          aria-label={`Borrar el aviso de ${name ?? "esta clienta"}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </span>
    </li>
  );
}
