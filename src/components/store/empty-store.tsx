import { MessageCircle } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import { LeafMark } from "./logo";

export function EmptyStore() {
  return (
    <section className="relative mx-auto max-w-3xl overflow-hidden px-4 py-16 text-center sm:py-24">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-6 left-6 size-16 rounded-full bg-sun" />
        <div className="absolute top-24 right-10 size-10 rounded-full bg-coral-deep/80" />
        <div className="absolute bottom-10 left-16 size-12 rounded-full bg-sage" />
        <div className="absolute right-20 bottom-20 size-20 rounded-full bg-lilac" />
      </div>
      <div className="animate-rise mx-auto flex size-28 items-center justify-center rounded-full border-2 border-forest bg-pink shadow-[4px_4px_0_var(--forest)]">
        <LeafMark className="animate-float size-16" />
      </div>
      <h2 className="mt-8 font-display text-3xl font-bold sm:text-5xl">
        Estamos preparando algo <span className="text-coral-deep">lindo</span> para vos.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-lg font-semibold text-muted">
        Pronto vas a encontrar tus favoritos Natura a precios especiales.
      </p>
      <div className="mt-8 flex justify-center">
        <LinkButton href="/contacto" variant="outline" size="lg">
          <MessageCircle className="size-5" aria-hidden="true" />
          Escribinos
        </LinkButton>
      </div>
    </section>
  );
}
