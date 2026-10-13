import { MessageCircle } from "lucide-react";

import { LinkButton } from "@/components/ui/button";
import { LeafMark } from "./logo";

export function EmptyStore() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:py-24">
      <div className="animate-rise mx-auto flex size-24 items-center justify-center rounded-full bg-blush">
        <LeafMark className="size-14 text-botanical" />
      </div>
      <h2 className="mt-8 font-display text-3xl font-semibold sm:text-4xl">
        Estamos preparando algo lindo para vos.
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-lg text-muted">
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
