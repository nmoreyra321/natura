import type { NextConfig } from "next";

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
  // Proyectos de Supabase alojados (fotos del catálogo).
  { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
];

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (supabaseUrl) {
  try {
    const { protocol, hostname, port } = new URL(supabaseUrl);
    remotePatterns.push({
      protocol: protocol.replace(":", "") as "http" | "https",
      hostname,
      port,
      pathname: "/storage/v1/object/public/**",
    });
  } catch {
    // URL inválida: se informa en el panel como configuración pendiente.
  }
}

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // En Vercel las fotos las achica el servicio de imágenes de Vercel, no la página: el programa
  // «sharp» (unos 48 MB) no se usa y solo agrandaba cada copia publicada (el «Functions Storage»).
  outputFileTracingExcludes: {
    "/**": ["node_modules/sharp/**", "node_modules/@img/**"],
  },
  experimental: {
    // Las fotos de la boleta de Natura viajan en una acción del panel (ya achicadas en el teléfono).
    serverActions: { bodySizeLimit: "4mb" },
  },
  images: {
    remotePatterns,
    // Un solo formato (WebP, lo leen todos los navegadores actuales) para gastar la mitad del cupo
    // gratis de fotos de Vercel. Cada foto nueva se guarda con otro nombre, así que se puede
    // recordar la versión achicada un mes sin volver a procesarla.
    formats: ["image/webp"],
    minimumCacheTTL: 2678400,
    // Solo para pruebas con Supabase local (127.0.0.1). Nunca activar en producción.
    dangerouslyAllowLocalIP: process.env.NEXT_IMAGE_ALLOW_LOCAL_IP === "1",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
