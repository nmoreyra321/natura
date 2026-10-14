"use client";

import { Analytics } from "@vercel/analytics/next";

/** Estadísticas de visitas (Vercel Web Analytics). No cuenta las visitas al panel de administración. */
export function SiteAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => (new URL(event.url).pathname.startsWith("/admin") ? null : event)}
    />
  );
}
