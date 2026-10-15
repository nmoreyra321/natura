import type { MetadataRoute } from "next";

import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/config";

/** Permite instalar la tienda en el celular como una app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_NAME,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // La app instalada se usa en vertical (en Android queda fija; el iPhone lo decide el sistema).
    orientation: "portrait",
    background_color: "#fff7ef",
    theme_color: "#fff7ef",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Productos", url: "/productos" },
      { name: "Ofertas", url: "/productos?ofertas=1" },
      { name: "Mi carrito", url: "/carrito" },
    ],
  };
}
