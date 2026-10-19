"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductImageFallback } from "@/components/store/product-card";

/**
 * Miniatura de producto. Pasa por el mismo camino que las fotos de la tienda (las sirve la propia
 * página) y, si una foto no carga, muestra el dibujo de siempre en vez del ícono roto.
 */
export function SafeThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ProductImageFallback className="size-full" />;
  return <Image src={src} alt="" fill sizes="96px" className="object-cover" onError={() => setFailed(true)} />;
}
