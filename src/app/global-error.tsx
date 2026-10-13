"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es-AR">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fbf6ee", color: "#1f3a2c", padding: "4rem 1rem", textAlign: "center" }}>
        <h1>Ups, algo salió mal</h1>
        <p>Probá recargar la página en unos segundos.</p>
        <button onClick={reset} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 999, border: 0, background: "#c2453a", color: "#fff", fontWeight: 700 }}>
          Reintentar
        </button>
      </body>
    </html>
  );
}
