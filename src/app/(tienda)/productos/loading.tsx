/** Mientras carga el catálogo se ven cuadritos que brillan, con la forma de las tarjetas. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6" role="status" aria-label="Cargando productos">
      <div className="skeleton h-9 w-56 rounded-full" />
      <div className="skeleton mt-4 h-11 w-full rounded-full" />
      <ul className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="overflow-hidden rounded-3xl bg-warm-white p-0 shadow-soft ring-1 ring-line/80">
            <div className="skeleton aspect-square" />
            <div className="flex flex-col gap-2 p-3.5">
              <div className="skeleton h-3 w-1/3 rounded-full" />
              <div className="skeleton h-4 w-5/6 rounded-full" />
              <div className="skeleton h-6 w-2/5 rounded-full" />
            </div>
          </li>
        ))}
      </ul>
      <span className="sr-only">Cargando…</span>
    </div>
  );
}
