/** Un ajuste: dice qué es y cómo está hoy; el formulario se abre recién al tocar «Cambiar». */
export function SettingCard({
  icon,
  title,
  state,
  children,
}: {
  icon: string;
  title: string;
  state: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-3xl bg-warm-white p-5 shadow-soft">
      <summary className="flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
        <span aria-hidden="true" className="text-3xl">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-xl leading-tight font-bold">{title}</span>
          <span className="block text-base text-muted">{state}</span>
        </span>
        <span className="rounded-full bg-sage px-4 py-2 font-extrabold text-botanical-deep group-open:hidden">Cambiar</span>
        <span className="hidden rounded-full bg-line px-4 py-2 font-extrabold text-muted group-open:inline">Cerrar</span>
      </summary>
      <div className="mt-4 border-t border-line pt-4">{children}</div>
    </details>
  );
}
