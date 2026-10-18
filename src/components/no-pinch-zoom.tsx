"use client";

import { useEffect } from "react";

/** El iPhone ignora «no agrandar» del viewport: se frena el gesto de pellizcar para que la página no se agrande sola. */
export function NoPinchZoom() {
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", stop);
    document.addEventListener("gesturechange", stop);
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
    };
  }, []);
  return null;
}
