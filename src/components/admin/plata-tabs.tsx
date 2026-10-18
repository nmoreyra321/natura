import Link from "next/link";

const TABS = [
  { href: "/admin/deudas", label: "Me deben" },
  { href: "/admin/ventas", label: "Vendí" },
  { href: "/admin/comision", label: "Comisión" },
] as const;

/** Solapas de «Plata»: juntan lo que te deben, lo que vendiste y la comisión de Mercado Pago. */
export function PlataTabs({ current }: { current: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Plata" className="mb-5 grid grid-cols-3 gap-1.5 rounded-2xl bg-line/70 p-1.5">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? "page" : undefined}
          className={`rounded-xl py-2.5 text-center text-base font-extrabold ${t.href === current ? "bg-warm-white shadow-soft" : "text-muted"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
