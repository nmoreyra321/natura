"use client";

import { useEffect, useRef } from "react";

/** «Todo al día»: un tilde que se dibuja solo y un mensaje cariñoso. */
export function AllDone({ message = "¡Todo al día, Mariel! Descansá 💖" }: { message?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    ref.current?.classList.add("go");
  }, []);
  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl bg-sage p-6 text-center text-botanical-deep">
      <svg ref={ref} className="all-done-check size-24" viewBox="0 0 110 110" aria-hidden="true">
        <circle cx="55" cy="55" r="47" />
        <path d="M32 57l16 16 31-34" />
      </svg>
      <p className="font-display text-xl font-bold">{message}</p>
    </div>
  );
}
