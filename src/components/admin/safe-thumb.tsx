"use client";

import { useState } from "react";
import { ProductImageFallback } from "@/components/store/product-card";

/** Miniatura que, si la foto no carga, muestra el dibujo de siempre en vez del ícono roto del navegador. */
export function SafeThumb({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <ProductImageFallback className="size-full" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="size-full object-cover" loading="lazy" onError={() => setFailed(true)} />;
}
