"use client";

import { useRef } from "react";

/**
 * Inclina un poquito lo que tiene adentro siguiendo el mouse (solo en computadora; con el dedo
 * no se mete para no molestar al deslizar la pantalla).
 */
export function Tilt({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse") return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    el.style.transform = `perspective(700px) rotateY(${(x - 0.5) * 10}deg) rotateX(${(0.5 - y) * 10}deg) translateY(-4px)`;
  };
  const leave = () => {
    if (ref.current) ref.current.style.transform = "";
  };

  return (
    <div ref={ref} onPointerMove={move} onPointerLeave={leave} className={`transition-transform duration-150 ease-out ${className}`}>
      {children}
    </div>
  );
}
