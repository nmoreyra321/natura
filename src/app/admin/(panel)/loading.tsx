/** Mientras se arma la pantalla del panel se ve el esqueleto al instante: así tocar la barra de abajo se siente rápido. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl" role="status" aria-label="Cargando">
      <div className="skeleton h-9 w-48 rounded-full" />
      <div className="skeleton mt-4 h-24 w-full rounded-3xl" />
      <div className="mt-3 flex flex-col gap-3">
        <div className="skeleton h-20 w-full rounded-2xl" />
        <div className="skeleton h-20 w-full rounded-2xl" />
        <div className="skeleton h-20 w-full rounded-2xl" />
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
