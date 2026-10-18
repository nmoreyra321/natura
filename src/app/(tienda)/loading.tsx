/** Mientras se arma la página (carrito, club, pedido…) se ve el esqueleto al instante, así la navegación se siente fluida. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6" role="status" aria-label="Cargando">
      <div className="skeleton h-9 w-56 rounded-full" />
      <div className="skeleton mt-5 h-40 w-full rounded-3xl" />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="skeleton h-28 rounded-3xl" />
        <div className="skeleton h-28 rounded-3xl" />
      </div>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
