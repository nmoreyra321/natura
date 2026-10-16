/** Asterisco rojo de «campo obligatorio» (los lectores de pantalla dicen «obligatorio»). */
export function Required() {
  return (
    <>
      <span aria-hidden="true" className="ml-0.5 font-extrabold text-coral-deep">
        *
      </span>
      <span className="sr-only"> (obligatorio)</span>
    </>
  );
}

/** Aclaración que va arriba del formulario. */
export function RequiredNote({ className = "" }: { className?: string }) {
  return (
    <p className={`text-xs text-muted ${className}`}>
      Los campos con <span className="font-extrabold text-coral-deep">*</span> son obligatorios.
    </p>
  );
}
