"use client";

import Image from "next/image";
import { useState } from "react";

import { ProductImageFallback } from "./product-card";

export function Gallery({ images, name }: { images: { id: string; url: string; alt: string | null }[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? images[0];
  if (!current) return <ProductImageFallback className="aspect-square w-full rounded-[2rem]" />;
  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-[2rem] bg-white shadow-soft ring-1 ring-line/80">
        <Image src={current.url} alt={current.alt || name} fill priority sizes="(min-width: 768px) 50vw, 100vw" className="object-cover" />
      </div>
      {images.length > 1 ? (
        <ul className="flex gap-2.5 overflow-x-auto p-1" aria-label="Fotos del producto">
          {images.map((img, i) => (
            <li key={img.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Ver foto ${i + 1}`}
                aria-current={i === active}
                className={`relative block size-18 overflow-hidden rounded-2xl bg-white ring-2 transition ${i === active ? "ring-coral-deep" : "ring-line/70 hover:ring-pink"}`}
              >
                <Image src={img.url} alt="" fill sizes="72px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
