import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacidad",
  description: "Qué datos guarda Natu Mariel y cómo pedir que se borren.",
};

/** Política de privacidad (la piden Google y Facebook para «Continuar con…»). */
export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Privacidad</h1>
      <div className="mt-6 flex flex-col gap-5 leading-relaxed text-forest/90">
        <section>
          <h2 className="font-display text-xl font-bold">Qué datos guardamos</h2>
          <p className="mt-1">
            Cuando hacés un pedido guardamos tu nombre, tu WhatsApp, lo que compraste y, si elegís envío, tu dirección. Los
            usamos solo para preparar y entregar tu pedido y para escribirte sobre él.
          </p>
          <p className="mt-2">
            Si entrás con Google o Facebook, recibimos tu nombre y tu mail. No vemos tu contraseña ni publicamos nada en tu
            nombre. Con tu cuenta guardamos tus pedidos y tu avance en el Club Natu Mariel.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold">Con quién los compartimos</h2>
          <p className="mt-1">
            Con nadie, salvo Mercado Pago si pagás con esa opción: ahí el pago lo procesa Mercado Pago con sus propias reglas.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold">Cómo borrar tus datos</h2>
          <p className="mt-1">
            Escribinos por WhatsApp desde la página de Contacto pidiendo que borremos tu cuenta y tus datos. Lo hacemos dentro
            de los 30 días y te avisamos cuando esté listo.
          </p>
        </section>
      </div>
    </div>
  );
}
