"use client";

import { Button, LinkButton } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-semibold">Ups, algo salió mal</h1>
      <p className="mt-3 max-w-md text-muted">Tuvimos un problema al cargar esta página. Probá de nuevo en unos segundos.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button onClick={reset}>Reintentar</Button>
        <LinkButton href="/" variant="outline">Ir al inicio</LinkButton>
      </div>
    </main>
  );
}
