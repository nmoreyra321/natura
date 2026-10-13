import { LinkButton } from "@/components/ui/button";
import { LeafMark } from "@/components/store/logo";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <LeafMark className="size-16 text-botanical" />
      <p className="mt-6 text-sm font-bold tracking-[0.14em] text-coral-deep uppercase">Error 404</p>
      <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">No encontramos esta página</h1>
      <p className="mt-3 max-w-md text-muted">
        Puede que el producto ya no esté disponible o que el enlace haya cambiado.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <LinkButton href="/productos">Ver productos</LinkButton>
        <LinkButton href="/" variant="outline">Ir al inicio</LinkButton>
      </div>
    </main>
  );
}
