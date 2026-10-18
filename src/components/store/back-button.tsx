"use client";

import { ArrowLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * «← Volver» arriba de cada página de la tienda (menos el inicio).
 * Vuelve a la página anterior si la clienta venía navegando la tienda; si entró directo
 * (por ejemplo, desde un link de WhatsApp), la lleva al inicio.
 */
export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  // Páginas recorridas dentro de la tienda desde que se abrió (el diseño no se desmonta al navegar).
  const visited = useRef(0);
  useEffect(() => {
    visited.current += 1;
  }, [pathname]);

  if (pathname === "/") return null;

  const goBack = () => {
    let cameFromStore = visited.current > 1;
    if (!cameFromStore) {
      try {
        cameFromStore = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
      } catch {
        cameFromStore = false;
      }
    }
    if (cameFromStore && window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <div className="mx-auto -mb-5 max-w-7xl px-4 pt-3 sm:mb-0 sm:px-6">
      <button
        type="button"
        onClick={goBack}
        className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-bold text-forest hover:bg-white"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Volver
      </button>
    </div>
  );
}
